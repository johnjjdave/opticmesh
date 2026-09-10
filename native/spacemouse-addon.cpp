// OpticMesh's camera-only adapter. Build against a separately installed 3DxWare SDK.
// No SDK sources or runtime DLL are redistributed; TDxNavLib ships with 3DxWare.
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <node_api.h>
#include <navlib/navlib.h>
#include <mutex>
#include <map>
#include <string>
#include <cmath>
using namespace navlib;
namespace {
std::recursive_mutex gate;
std::map<std::string, value_t> values;
HMODULE library = nullptr;
nlHandle_t handle = 0;
decltype(&NlCreate) createNav = nullptr;
decltype(&NlClose) closeNav = nullptr;
decltype(&NlWriteValue) writeNav = nullptr;
decltype(&NlReadValue) readNav = nullptr;
bool active = false, pending = false;
long transaction = 0;
long getProperty(param_t, property_t name, value_t* out) {
  std::lock_guard<std::recursive_mutex> lock(gate);
  auto found = values.find(name);
  if (found == values.end()) return make_result_code(navlib_errc::no_data_available);
  *out = found->second; return 0;
}
long setProperty(param_t, property_t name, const value_t* in) {
  std::lock_guard<std::recursive_mutex> lock(gate);
  if (!strcmp(name, transaction_k)) { transaction = in->l; return 0; }
  if (!strcmp(name, motion_k)) { values[name] = *in; return 0; }
  if (!active) return 0;
  if (!strcmp(name, view_affine_k) || !strcmp(name, view_extents_k) || !strcmp(name, pivot_position_k) || !strcmp(name, view_target_k)) {
    // A scene selection explicitly owns the camera orbit reference. Automatic
    // pivot notifications must not replace it with the origin or a hit point.
    if (!strcmp(name,pivot_position_k) && values.count(selection_empty_k) && !values[selection_empty_k].b) return 0;
    values[name] = *in; pending = true; return 0;
  }
  // Deliberately no selection transform setters: navigation cannot edit objects.
  return make_result_code(navlib_errc::invalid_operation);
}
void closeConnection(void*) {
  if (handle) { auto h = handle; handle = 0; closeNav(h); }
  std::lock_guard<std::recursive_mutex> lock(gate);
  active = pending = false; transaction = 0; values.clear();
  // Keep the library loaded until process exit: driver cleanup can be asynchronous.
}
napi_value boolean(napi_env env, bool b) { napi_value out; napi_get_boolean(env,b,&out);return out; }
bool numberArray(napi_env env,napi_value obj,const char* key,double* out,size_t count) {
  napi_value a; bool yes=false; uint32_t length=0;
  if(napi_get_named_property(env,obj,key,&a)!=napi_ok || napi_is_array(env,a,&yes)!=napi_ok || !yes || napi_get_array_length(env,a,&length)!=napi_ok || length!=count)return false;
  for(uint32_t i=0;i<count;i++){napi_value v;if(napi_get_element(env,a,i,&v)!=napi_ok || napi_get_value_double(env,v,&out[i])!=napi_ok || !std::isfinite(out[i]))return false;}
  return true;
}
void readState(napi_env env,napi_value obj) {
  matrix_t matrix{}; box_t bounds{},extents{}; frustum_t frustum{}; point_t target{}; plane_t plane{};
  double size[6],view[6],planes[6],point[3],normal[4];
  if(numberArray(env,obj,"matrix",&matrix.m00,16))values[view_affine_k]=matrix;
  if(numberArray(env,obj,"bounds",size,6)){bounds.min={size[0],size[1],size[2]};bounds.max={size[3],size[4],size[5]};values[model_extents_k]=bounds;}
  if(numberArray(env,obj,"extents",view,6)){extents.min={view[0],view[1],view[2]};extents.max={view[3],view[4],view[5]};values[view_extents_k]=extents;}
  if(numberArray(env,obj,"frustum",planes,6)){frustum={planes[0],planes[1],planes[2],planes[3],planes[4],planes[5]};values[view_frustum_k]=frustum;}
  if(numberArray(env,obj,"target",point,3)){target={point[0],point[1],point[2]};values[view_target_k]=target;}
  // Only seed a pivot when the scene/selection reference changes. Camera sync
  // must not reset a pivot selected by the driver.
  if(numberArray(env,obj,"pivot",point,3)){
    target={point[0],point[1],point[2]};
    auto found=values.find("opticmesh.reference");
    if(found==values.end() || found->second.point.x!=target.x || found->second.point.y!=target.y || found->second.point.z!=target.z){
      values[pivot_position_k]=target;values["opticmesh.reference"]=target;
    }
  }
  bool selected=numberArray(env,obj,"selectionBounds",size,6);
  values[selection_empty_k]=!selected;
  if(selected && values.count("opticmesh.reference"))values[pivot_position_k]=values["opticmesh.reference"];
  if(selected){bounds.min={size[0],size[1],size[2]};bounds.max={size[3],size[4],size[5]};values[selection_extents_k]=bounds;}
  else values.erase(selection_extents_k);
  if(numberArray(env,obj,"plane",normal,4)){plane={normal[0],normal[1],normal[2],normal[3]};values[view_constructionPlane_k]=plane;}
  napi_value p;bool perspective=true;napi_get_named_property(env,obj,"perspective",&p);napi_get_value_bool(env,p,&perspective);
  values[view_perspective_k]=perspective; values[view_rotatable_k]=perspective;
  double focus=1;if(napi_get_named_property(env,obj,"distance",&p)==napi_ok && napi_get_value_double(env,p,&focus)==napi_ok && std::isfinite(focus))values[view_focusDistance_k]=std::max(.1,focus);
}
void publishSelectionPivot() {
  value_t pivot; bool selected=false;
  {std::lock_guard<std::recursive_mutex> lock(gate);
    selected=values.count(selection_empty_k) && !values[selection_empty_k].b;
    if(selected) pivot=values[pivot_position_k];
  }
  if(!handle)return;
  if(selected)writeNav(handle,pivot_position_k,&pivot);
  else {value_t automatic(false);writeNav(handle,pivot_user_k,&automatic);}
}
napi_value open(napi_env env,napi_callback_info info) {
  size_t argc=1;napi_value args[1];napi_get_cb_info(env,info,&argc,args,nullptr,nullptr);
  if(handle)return boolean(env,true);
  if(!argc)return boolean(env,false);
  if(!library)library=LoadLibraryExW(L"TDxNavLib.dll",nullptr,LOAD_LIBRARY_SEARCH_SYSTEM32);
  if(!library)return boolean(env,false);
  createNav=reinterpret_cast<decltype(createNav)>(GetProcAddress(library,"NlCreate"));
  closeNav=reinterpret_cast<decltype(closeNav)>(GetProcAddress(library,"NlClose"));
  writeNav=reinterpret_cast<decltype(writeNav)>(GetProcAddress(library,"NlWriteValue"));
  readNav=reinterpret_cast<decltype(readNav)>(GetProcAddress(library,"NlReadValue"));
  if(!createNav||!closeNav||!writeNav||!readNav)return boolean(env,false);
  {std::lock_guard<std::recursive_mutex> lock(gate);
    matrix_t identity{};identity.m00=identity.m11=identity.m22=identity.m33=1;
    values[coordinate_system_k]=identity;values[views_front_k]=identity;
    values[selection_empty_k]=true;values[model_unitsToMeters_k]=1.;values[motion_k]=false;
    readState(env,args[0]);
  }
  accessor_t accessors[]={
    {coordinate_system_k,getProperty,nullptr,0},{views_front_k,getProperty,nullptr,0},
    {view_affine_k,getProperty,setProperty,0},{view_extents_k,getProperty,setProperty,0},
    {view_frustum_k,getProperty,nullptr,0},{view_perspective_k,getProperty,nullptr,0},
    {view_rotatable_k,getProperty,nullptr,0},{view_constructionPlane_k,getProperty,nullptr,0},
    {view_target_k,getProperty,setProperty,0},{view_focusDistance_k,getProperty,nullptr,0},
    {pivot_position_k,getProperty,setProperty,0},{model_extents_k,getProperty,nullptr,0},
    {model_unitsToMeters_k,getProperty,nullptr,0},{selection_empty_k,getProperty,nullptr,0},
    {selection_extents_k,getProperty,nullptr,0},
    {motion_k,getProperty,setProperty,0},{transaction_k,nullptr,setProperty,0}
  };
  nlCreateOptions_t options{sizeof(nlCreateOptions_t),true,none};
  long result=createNav(&handle,"OpticMesh",accessors,sizeof(accessors)/sizeof(accessors[0]),&options);
  if(result){handle=0;return boolean(env,false);}return boolean(env,true);
}
napi_value sync(napi_env env,napi_callback_info info) {
  size_t argc=1;napi_value args[1];napi_get_cb_info(env,info,&argc,args,nullptr,nullptr);if(!handle||!argc)return boolean(env,false);
  std::map<std::string,value_t> copy;
  {std::lock_guard<std::recursive_mutex> lock(gate);readState(env,args[0]);pending=false;copy=values;}
  // Publish external mouse/camera changes back to the navigation library.
  for(auto key:{view_affine_k,view_extents_k,view_frustum_k,view_perspective_k,view_rotatable_k,view_target_k,model_extents_k,selection_empty_k})writeNav(handle,key,&copy[key]);
  if(copy.count(selection_extents_k))writeNav(handle,selection_extents_k,&copy[selection_extents_k]);
  // Selected bounds alone are advisory; automatic pivot modes may ignore them.
  // Pin the actual driver pivot while selected, release it when selection clears.
  publishSelectionPivot();
  return boolean(env,true);
}
napi_value focus(napi_env env,napi_callback_info info) {
  size_t argc=1;napi_value args[1];bool enabled=false;napi_get_cb_info(env,info,&argc,args,nullptr,nullptr);if(argc)napi_get_value_bool(env,args[0],&enabled);
  {std::lock_guard<std::recursive_mutex> lock(gate);active=enabled;pending=false;transaction=0;}
  if(handle){value_t value(enabled);writeNav(handle,active_k,&value);writeNav(handle,focus_k,&value);if(enabled)publishSelectionPivot();if(!enabled){value_t stopped(false);writeNav(handle,motion_k,&stopped);}}
  return boolean(env,enabled);
}
void arrayProperty(napi_env env,napi_value obj,const char* name,const double* values,size_t n){napi_value a;napi_create_array_with_length(env,n,&a);for(uint32_t i=0;i<n;i++){napi_value v;napi_create_double(env,values[i],&v);napi_set_element(env,a,i,v);}napi_set_named_property(env,obj,name,a);}
napi_value poll(napi_env env,napi_callback_info) {
  std::lock_guard<std::recursive_mutex> lock(gate);napi_value out;
  if(!handle||!active||!pending||transaction){napi_get_null(env,&out);return out;}pending=false;
  napi_create_object(env,&out);arrayProperty(env,out,"matrix",&values[view_affine_k].matrix.m00,16);
  const auto& b=values[view_extents_k].box;double extents[]={b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z};arrayProperty(env,out,"extents",extents,6);
  const auto& target=values[values[selection_empty_k].b ? view_target_k : pivot_position_k].point;double point[]={target.x,target.y,target.z};arrayProperty(env,out,"target",point,3);
  return out;
}
// Diagnostic readback for native integration tests; not exposed to web content.
napi_value navigationState(napi_env env,napi_callback_info){
  napi_value out;napi_create_object(env,&out);napi_set_named_property(env,out,"connected",boolean(env,handle!=0));
  if(handle && readNav){
    value_t user,pivot;
    long userResult=readNav(handle,pivot_user_k,&user),pivotResult=readNav(handle,pivot_position_k,&pivot);
    if(!userResult)napi_set_named_property(env,out,"fixedPivot",boolean(env,user.b));
    if(!pivotResult){double point[]={pivot.point.x,pivot.point.y,pivot.point.z};arrayProperty(env,out,"pivot",point,3);}
  }
  return out;
}
napi_value close(napi_env env,napi_callback_info){closeConnection(nullptr);return boolean(env,true);}
napi_value init(napi_env env,napi_value exports){napi_add_env_cleanup_hook(env,closeConnection,nullptr);for(auto pair:{std::pair<const char*,napi_callback>{"open",open},{"sync",sync},{"focus",focus},{"poll",poll},{"navigationState",navigationState},{"close",close}}){napi_value fn;napi_create_function(env,pair.first,NAPI_AUTO_LENGTH,pair.second,nullptr,&fn);napi_set_named_property(env,exports,pair.first,fn);}return exports;}
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
