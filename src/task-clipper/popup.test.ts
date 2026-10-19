// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';

const api = vi.hoisted(() => ({
 storage: {
  sync: { get: vi.fn(async () => ({fjgTaskClipperSettings:{projects:['Legacy project'],people:['Sam Lee']}})), set:vi.fn(async()=>{}) },
  local: { get: vi.fn(async () => ({fjgTaskClipperCatalogSettings:{catalogToken:'test',catalogPort:27124}})), remove:vi.fn(async()=>{}) },
 },
 tabs: {query: vi.fn(async()=>[])},
 runtime: {sendMessage:vi.fn(async(_message: {url:string})=>({success:true})),openOptionsPage:vi.fn()},
}));
vi.mock('../utils/browser-polyfill',()=>({default:api}));

test('the popup sends all checked People, including filtered names, without a project assignment', async()=>{
 document.body.innerHTML=readFileSync('src/popup.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'');
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({people:['Alex Rivera','Sam Lee']})})));
 vi.spyOn(window,'close').mockImplementation(()=>{});
 await import('./popup');
 document.dispatchEvent(new Event('DOMContentLoaded'));
 await vi.waitFor(()=>expect(document.querySelectorAll('#people-list input')).toHaveLength(2));
 expect(document.querySelectorAll('#people-list input:checked')).toHaveLength(0);
 expect(document.querySelector('#project-select')).toBeNull();
 const title=document.querySelector<HTMLInputElement>('#task-title')!;
 title.value='People capture validation';
 title.dispatchEvent(new Event('input'));
 for(const input of Array.from(document.querySelectorAll<HTMLInputElement>('#people-list input'))) input.click();
 const search=document.querySelector<HTMLInputElement>('#people-search')!;
 search.value='Sam';search.dispatchEvent(new Event('input'));
 expect(document.querySelector('#people-summary')?.textContent).toBe('People (2)');
 expect(document.querySelector('#task-preview')?.textContent).toContain('People: Alex Rivera; Sam Lee');
 document.querySelector<HTMLButtonElement>('#save-task')!.click();
 await vi.waitFor(()=>expect(api.runtime.sendMessage).toHaveBeenCalled());
 const message=api.runtime.sendMessage.mock.calls[0][0] as unknown as {url:string};
 const encoded=new URL(message.url).searchParams.get('payload')!;
 const payload=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
 expect(payload.people).toEqual(['Alex Rivera','Sam Lee']);
 expect(payload.project).toBeUndefined();
 expect(payload.title).toBe('People capture validation');
});
