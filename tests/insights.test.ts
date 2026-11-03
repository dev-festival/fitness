import assert from "node:assert/strict";
import { test } from "node:test";
import { GET,POST } from "../app/api/insights/route";
import { addEntry,deleteEntry,getData,saveSettings } from "../lib/db";

test("cards never call AI on GET, reuse cached output, and invalidate it when records or goals change",async()=>{
  const vars=["APP_PASSWORD","VERCEL","DATABASE_URL","DATABASE_AUTH_TOKEN","OPENAI_API_KEY"];
  const old=vars.map(name=>process.env[name]);const original=globalThis.fetch;
  let calls=0;let mutateDuringCall=false;
  const params={mode:"trends",from:"2026-10-21",through:"2026-11-03",timeZone:"America/Chicago"};
  const getRequest=()=>new Request("http://localhost:3000/api/insights?"+new URLSearchParams(params));
  const postRequest=(extra={})=>new Request("http://localhost:3000/api/insights",{method:"POST",headers:{Origin:"http://localhost:3000","Content-Type":"application/json"},body:JSON.stringify({...params,...extra})});
  try{
    delete process.env.APP_PASSWORD;delete process.env.VERCEL;delete process.env.DATABASE_AUTH_TOKEN;
    process.env.DATABASE_URL="file::memory:";process.env.OPENAI_API_KEY="test-key-never-sent";
    globalThis.fetch=async(_url,init)=>{
      calls++;const body=JSON.parse(String(init?.body));assert.equal(body.store,false);assert.equal(body.text.format.name,"companion_insight");
      if(mutateDuringCall)await addEntry({kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T20:00:00Z",note:"A changed record"});
      return Response.json({output:[{content:[{type:"output_text",text:JSON.stringify({title:"A moment to notice",text:"You recorded one meal and a nearby thought.",suggestion:"Keep noticing the moments around meals."})}]}]});
    };
    await addEntry({kind:"food",date:"2026-11-03",occurredAt:"2026-11-03T18:00:00Z",name:"Lunch",calories:500,protein:30,carbs:40,fat:20,source:"away",costCents:850});
    assert.equal((await (await GET(getRequest())).json()).card,null);assert.equal(calls,0);
    assert.equal((await POST(postRequest())).status,200);assert.equal(calls,1);
    assert.equal((await POST(postRequest())).status,200);assert.equal(calls,1);
    assert.ok((await (await GET(getRequest())).json()).card);assert.equal(calls,1);
    assert.equal((await POST(postRequest({force:true}))).status,200);assert.equal(calls,2);
    const data=await getData();await deleteEntry(data.entries[0].id);
    assert.equal((await (await GET(getRequest())).json()).card,null);assert.equal(calls,2);
    assert.equal((await POST(postRequest())).status,200);assert.equal(calls,3);
    await saveSettings({...data.settings,reason:"A different reason"});
    assert.equal((await (await GET(getRequest())).json()).card,null);
    mutateDuringCall=true;
    assert.equal((await POST(postRequest())).status,409);assert.equal((await (await GET(getRequest())).json()).card,null);
    const count=calls;
    assert.equal((await POST(postRequest({timeZone:"not/a-zone"}))).status,400);assert.equal(calls,count);
    const cross=new Request("http://localhost:3000/api/insights",{method:"POST",headers:{Origin:"https://untrusted.example"},body:JSON.stringify(params)});
    assert.equal((await POST(cross)).status,401);assert.equal(calls,count);
    delete process.env.OPENAI_API_KEY;assert.equal((await POST(postRequest())).status,503);assert.equal(calls,count);
  }finally{globalThis.fetch=original;vars.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i];});}
});
