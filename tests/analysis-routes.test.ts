import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as foodPOST } from "../app/api/food/estimate/route";
import { POST as journalPOST } from "../app/api/journal/sentiment/route";
import { validateFoodImage,readLimitedJson } from "../lib/analysis";

const request=(path:string,body:unknown)=>new Request(`http://localhost:3000${path}`,{method:"POST",headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},body:JSON.stringify(body)});
test("food photo/description and sentiment routes validate provider output and never write logs",async()=>{
  const vars=["APP_PASSWORD","VERCEL","OPENAI_API_KEY"];
  const old=vars.map(name=>process.env[name]);const original=globalThis.fetch;
  const calls:any[]=[];let output:any={identifiable:true,name:"Eggs on toast",calories:420,protein:22,carbs:30,fat:24,confidence:"medium",assumptions:"Two eggs, one slice of buttered toast"};
  try{
    delete process.env.APP_PASSWORD;delete process.env.VERCEL;process.env.OPENAI_API_KEY="test-only";
    globalThis.fetch=async(_url,init)=>{calls.push(JSON.parse(String(init?.body)));return Response.json({output:[{content:[{type:"output_text",text:JSON.stringify(output)}]}]});};
    const response=await foodPOST(request("/api/food/estimate",{description:"Two eggs and toast"}));
    assert.equal(response.status,200);assert.equal((await response.json()).estimate.calories,420);
    assert.equal(calls[0].store,false);assert.equal(calls[0].text.format.type,"json_schema");
    const photo="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1xkAAAAASUVORK5CYII=";
    assert.equal((await foodPOST(request("/api/food/estimate",{image:photo}))).status,200);
    assert.equal(calls[1].input[0].content[1].type,"input_image");
    assert.equal((await foodPOST(request("/api/food/estimate",{image:"https://arbitrary.example/image.jpg"}))).status,400);
    assert.equal(calls.length,2);
    output={...output,calories:-50};assert.equal((await foodPOST(request("/api/food/estimate",{description:"Eggs"}))).status,502);
    output={...output,identifiable:false,calories:0,name:""};assert.equal((await foodPOST(request("/api/food/estimate",{description:"A blurry shape"}))).status,422);
    output={score:0.6,summary:"The entry expresses optimism."};
    const tone=await journalPOST(request("/api/journal/sentiment",{note:"I’m glad I got outside today."}));
    assert.equal(tone.status,200);assert.equal((await tone.json()).sentiment.score,0.6);
    output={score:5,summary:"Invalid"};assert.equal((await journalPOST(request("/api/journal/sentiment",{note:"A note"}))).status,502);
    const crossOrigin=new Request("http://localhost:3000/api/food/estimate",{method:"POST",headers:{Origin:"https://untrusted.example"},body:"{}"});
    assert.equal((await foodPOST(crossOrigin)).status,401);
    delete process.env.OPENAI_API_KEY;assert.equal((await journalPOST(request("/api/journal/sentiment",{note:"A note"}))).status,503);
  }finally{globalThis.fetch=original;vars.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i];});}
});
test("image validation rejects disguised or oversized files and streaming body limits are enforced",async()=>{
  assert.throws(()=>validateFoodImage("data:image/jpeg;base64,SGVsbG8="));
  assert.throws(()=>validateFoodImage("data:image/svg+xml;base64,PHN2Zz4="));
  const big=Buffer.alloc(2*1024*1024+1);big[0]=255;big[1]=216;big[2]=255;
  assert.throws(()=>validateFoodImage("data:image/jpeg;base64,"+big.toString("base64")));
  await assert.rejects(()=>readLimitedJson(request("/api/test",{note:"x".repeat(100)}),20),/too large/);
});
