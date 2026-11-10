import {NextResponse} from "next/server";import {ZodError} from "zod";
export function ok(data:unknown,status=200){return NextResponse.json(data,{status})}
export function fail(message:string,status=400){return NextResponse.json({error:message},{status})}
export function errorResponse(e:unknown){if(e instanceof ZodError)return fail(e.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; "),422);console.error("API error",e);return fail("Request could not be processed",500)}
export function ensureSameOrigin(req:Request){const origin=req.headers.get("origin");if(!origin)return true;try{const a=new URL(origin),b=new URL(req.url);return a.host===b.host&&a.protocol===b.protocol}catch{return false}}
export function safeJson(req:Request){return req.json()}
