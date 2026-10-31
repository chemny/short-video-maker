import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
const skill=fileURLToPath(new URL('../../',import.meta.url));
export const renderSource=(plan,job)=>{
 const source=plan.meta.renderSource;if(!source)return {kind:'template',entry:path.join(skill,'remotion/src/index.ts'),cwd:path.join(skill,'remotion'),composition:'ShortVideo',cover:'CoverStill',template:plan.style?.template??null};
 if(plan.meta.renderEngine&&plan.meta.renderEngine!=='remotion')throw Error('Authored Remotion entry cannot be selected with another engine');
 if(source.kind!=='authored-remotion'||typeof source.entry!=='string'||path.isAbsolute(source.entry))throw Error('Declare a job-local authored-remotion entry');
 const file=path.resolve(job,source.entry);if(!fs.realpathSync(file).startsWith(fs.realpathSync(job)+path.sep)||!/^\w[\w-]*$/.test(source.composition??'')||source.layoutProtocol!=='svm-layout-v1')throw Error('Authored renderer needs local source, composition ID and shared layout protocol');
 return {kind:source.kind,entry:file,cwd:job,composition:source.composition,cover:source.coverComposition??source.composition,template:null};
};
export const rendererIdentity=(plan,job)=>{const s=renderSource(plan,job);return {kind:s.kind,entry:s.kind==='template'?'remotion/src/index.ts':plan.meta.renderSource.entry,composition:s.composition,template:s.template};};
