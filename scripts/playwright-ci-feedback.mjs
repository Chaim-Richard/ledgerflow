import {readFile} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripVTControlCharacters} from 'node:util';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const array=value=>Array.isArray(value)?value:[];
const text=value=>typeof value==='string'?value:'';
const escapeData=value=>stripVTControlCharacters(value).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');
const escapeProperty=value=>escapeData(value).replace(/:/g,'%3A').replace(/,/g,'%2C');

// Diagnostics only: the workflow preserves Playwright's original exit status.
export function failureAnnotations(report,workspace=process.cwd()){
  const annotations=[];
  const root=text(object(object(report).config).rootDir);
  function sourceFile(file){
    if(!root||!file)return file;
    const path=relative(workspace,resolve(root,file));
    return path==='..'||path.startsWith('../')||isAbsolute(path)?'':path.replaceAll('\\','/');
  }
  function error(message,file='',line){
    const location=file?` file=${escapeProperty(file)}${Number.isSafeInteger(line)&&line>0?`,line=${line}`:''}`:'';
    annotations.push(`::error${location}::${escapeData(message.slice(0,2500))}`);
  }
  for(const failure of array(object(report).errors))error(`Playwright setup: ${text(object(failure).message)||'See job output.'}`);
  function visit(value,parents=[]){
    const suite=object(value),titles=[...parents,...(text(suite.title)?[suite.title]:[])];
    for(const value of array(suite.specs)){
      const spec=object(value);
      if(spec.ok!==false)continue;
      const tests=array(spec.tests).map(object),unexpected=tests.filter(test=>test.status==='unexpected');
      for(const test of unexpected.length?unexpected:tests){
        const result=object(array(test.results).at(-1));
        const message=text(object(result.error).message)||array(result.errors).map(error=>text(object(error).message)).find(Boolean)||`Unexpected ${text(result.status)||'result'} (expected ${text(test.expectedStatus)||'passed'}).`;
        error(`${[...titles,text(spec.title)].filter(Boolean).join(' › ')}: ${message}`,sourceFile(text(spec.file)||text(suite.file)),spec.line);
      }
    }
    for(const child of array(suite.suites))visit(child,titles);
  }
  for(const suite of array(object(report).suites))visit(suite);
  return annotations;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{
    for(const annotation of failureAnnotations(JSON.parse(await readFile(process.argv[2],'utf8'))))console.log(annotation);
  }catch{
    console.log('::warning::Browser JSON diagnostics unavailable; the original test exit status still determines this job.');
  }
}
