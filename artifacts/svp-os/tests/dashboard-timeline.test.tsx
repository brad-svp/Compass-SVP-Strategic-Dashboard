import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import type { CalendarEvent,SixPeriod,SixItem } from "@workspace/api-client-react";
import { periodCovering,myItemsIn,ninetyDayWindow,upcomingEvents,eventHref } from "../src/components/home/dashboard-helpers";
import { YearAgenda } from "../src/components/calendar/year-agenda";

const event=(id:string,startDate:string|null,endDate=startDate,dateStatus="confirmed",planningYear=2026)=>({
  id,title:id,program:"Think Tank",planningYear,startDate,endDate,allDay:true,startsAt:null,endsAt:null,location:"",
  dateStatus,locationStatus:"tbd",audience:[],wixUrl:"",notes:"",ownerId:null,version:1,
}) as CalendarEvent;
test("dashboard picks a truly current period and only the signed-in person's items",()=>{
  const periods=[{id:"old",startDate:"2026-01-01",endDate:"2026-02-10"},{id:"current",startDate:"2026-11-09",endDate:"2026-12-20"}] as SixPeriod[];
  assert.equal(periodCovering(periods,"2026-11-16")?.id,"current");
  assert.equal(periodCovering(periods,"2027-01-01"),null);
  const items=[{id:"mine",periodId:"current",ownerId:"me"},{id:"theirs",periodId:"current",ownerId:"other"},{id:"older",periodId:"old",ownerId:"me"}] as SixItem[];
  assert.deepEqual(myItemsIn(items,"current","me").map(i=>i.id),["mine"]);
});
test("next 90 days crosses years, includes ongoing events, and omits cancelled/undated/outside events",()=>{
  assert.deepEqual(ninetyDayWindow("2026-11-16"),{from:"2026-11-16",to:"2027-02-13"});
  const events=[event("past","2026-11-14"),event("ongoing","2026-11-14","2026-11-18"),event("today","2026-11-16"),event("boundary","2027-02-13"),event("later","2027-02-14"),event("cancelled","2027-01-01","2027-01-01","cancelled"),event("undated",null)];
  assert.deepEqual(upcomingEvents(events,"2026-11-16").map(e=>e.id),["ongoing","today","boundary"]);
  assert.equal(eventHref(event("next/year","2027-02-13"),"2026-11-16"),"/calendar?event=next%2Fyear&year=2027");
  assert.match(eventHref(event("cross","2026-12-30","2027-01-02"),"2027-01-01"),/year=2027/);
});
test("timeline exposes all years, today's anchor and keyboard-accessible Earlier/Later navigation",()=>{
  const html=renderToStaticMarkup(<Router><YearAgenda events={[event("past","2025-01-01"),event("future","2027-02-01"),event("undated",null,null,"tbd",2027)]} today="2026-11-16" anchorKey="all" todayNonce={0} onOpen={()=>{}} /></Router>);
  assert.match(html,/data-testid="timeline-today"/);
  assert.match(html,/data-testid="pane-timeline"/);
  assert.match(html,/tabindex="0"/);
  assert.match(html,/button-timeline-earlier/);
  assert.match(html,/button-timeline-later/);
  assert.match(html,/2025/);assert.match(html,/2027/);
  assert.match(html,/Month TBD/);
  assert.ok(html.indexOf('row-event-past')<html.indexOf('timeline-today'));
  assert.ok(html.indexOf('timeline-today')<html.indexOf('row-event-future'));
});
