import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BODY_MATERIAL,resolveBodyAppearance,validateBodyAppearances} from '../app/slice-material.ts';

test('extrusions inherit group materials and independent display overrides',()=>{
 const groups=[{id:'outer',parentId:null,sliceIds:[]},{id:'inner',parentId:'outer',sliceIds:['screen']}];
 const values={outer:{material:{...DEFAULT_BODY_MATERIAL,color:'#aabbcc'},style:'wireframe'},inner:{style:'shaded'}};
 assert.deepEqual(resolveBodyAppearance('screen',groups,values),{material:values.outer.material,style:'shaded'});
 values.screen={material:{...DEFAULT_BODY_MATERIAL,metallic:1}};assert.equal(resolveBodyAppearance('screen',groups,values).material.metallic,1);
 delete values.screen;assert.equal(resolveBodyAppearance('screen',groups,values).material.color,'#aabbcc');
 assert.equal(resolveBodyAppearance('other',groups,values).material,DEFAULT_BODY_MATERIAL);
 assert.equal(resolveBodyAppearance('inner',groups,values).material.color,'#aabbcc');
});
test('extrusion material persistence rejects malformed values and retains legacy defaults',()=>{
 assert.deepEqual(validateBodyAppearances(undefined),{});
 const value={screen:{material:{...DEFAULT_BODY_MATERIAL},style:'wireframe'}};assert.deepEqual(validateBodyAppearances(JSON.parse(JSON.stringify(value))),value);
 for(const bad of [[],{screen:null},{screen:{style:'invalid'}},{screen:{material:{...DEFAULT_BODY_MATERIAL,color:'white'}}},{screen:{material:{...DEFAULT_BODY_MATERIAL,specular:2}}}])assert.throws(()=>validateBodyAppearances(bad),/extrusion/);
});
