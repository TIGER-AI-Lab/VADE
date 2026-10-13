/* Finance 50: lazy, selected-only results, visible trajectories and audit analysis. */
window.FinanceReview = function ({h, append, S, openOverlay, subBar, loadTask, publicId, publicText, publicHash, sourceId, sourceHash}) {
  const models = S.finance50.models, tasks = S.tasks.filter(t => t.id.startsWith('FIN2-'));
  const labels = {PASS:'Passed', FAIL:'Failed', UNRESOLVED:'Inconclusive', MISSING:'Grade unavailable', INCOMPLETE:'No completed answer'};
  const fmt = (v,d=0) => v == null ? '—' : Number(v).toLocaleString('en-US',{maximumFractionDigits:d});
  const usd = v => v == null ? '—' : '$' + Number(v).toFixed(v < 0.1 ? 3 : 2);
  const tid = n => `FIN2-${String(n).padStart(3,'0')}`;
  const url = (id,m,extra='') => `#trajectory/${publicId(id)}/${m}${extra}`;
  const link = (n,m,extra='',text=null) => h('a',{href:url(tid(n),m,extra),text:publicText(text || `${tid(n)} · ${models[m]}`)});
  const pill = status => h('span',{class:`grade ${(status||'MISSING').toLowerCase()}`,text:labels[status||'MISSING'] || status});
  const p = text => h('p',{text:publicText(text)});
  const section = (id,title,...kids) => h('section',{class:'audit-section',id},h('h2',{text:title}),kids);
  const table = (heads,rs) => h('div',{class:'audit-table-wrap'},h('table',{class:'audit-table'},
    h('thead',{},h('tr',{},heads.map(t=>h('th',{scope:'col',text:t})))),h('tbody',{},rs.map(r=>h('tr',{},r.map(c=>h('td',{},c)))))));
  const pending = new Map(); let generation = 0, analysisState = null, saveAnalysis = null;
  function script(src,store,key) {
    if (window[store] && window[store][key]) return Promise.resolve(window[store][key]);
    if (pending.has(src)) return pending.get(src);
    const promise = new Promise((resolve,reject)=>{
      const el=document.createElement('script');el.src=src;
      el.onload=()=>{const value=window[store]&&window[store][key]; if(value) resolve(value);else reject(new Error('This response could not be loaded.'));el.remove();};
      el.onerror=()=>{el.remove();reject(new Error('This response could not be loaded.'));};document.head.append(el);
    }).finally(()=>pending.delete(src)); pending.set(src,promise);return promise;
  }
  function raw(text) {return h('pre',{class:'raw-text',text:typeof text==='string'?text:JSON.stringify(text,null,2)});}
  function inline(text) {
    const out=[]; const re=/(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*\n]+)\*|(?<!\w)_([^_\n]+)_(?!\w))/g;
    let start=0,m;while((m=re.exec(text))){out.push(text.slice(start,m.index));out.push(m[2]?h('strong',{text:m[2]}):m[3]?h('code',{text:m[3]}):m[6]||m[7]?h('em',{text:m[6]||m[7]}):h('a',{href:m[5],target:'_blank',rel:'noopener noreferrer',text:m[4]}));start=re.lastIndex;}out.push(text.slice(start));return out;
  }
  function markdown(text) {
    const math=window.VadeMath.prepare(String(text||''));
    const root=h('div',{class:'answer-prose'}), lines=math.text.split('\n');let i=0;
    while(i<lines.length){const l=lines[i];if(!l.trim()){i++;continue;}
      if(/^```/.test(l)){let code=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i++]);i++;root.append(raw(code.join('\n')));continue;}
      const head=/^(#{1,6})\s+(.*)/.exec(l);if(head){root.append(h(`h${Math.min(head[1].length+2,6)}`,{},inline(head[2])));i++;continue;}
      if(l.includes('|') && i+1<lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i+1])){
        const cells=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());const heads=cells(l);i+=2;const rs=[];
        while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rs.push(cells(lines[i++]).map(x=>h('span',{},inline(x))));root.append(table(heads,rs));continue;}
      if(/^\s*([-*+] |\d+[.)] )/.test(l)){const ordered=/^\s*\d/.test(l),ul=h(ordered?'ol':'ul');
        while(i<lines.length&&/^\s*([-*+] |\d+[.)] )/.test(lines[i]))ul.append(h('li',{},inline(lines[i++].replace(/^\s*([-*+] |\d+[.)] )/,''))));root.append(ul);continue;}
      if(/^\s*---+\s*$/.test(l)){root.append(h('hr'));i++;continue;}
      if(/^>/.test(l)){root.append(h('blockquote',{},inline(l.replace(/^>\s?/,''))));i++;continue;}
      const para=[l];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,6}\s|```|\s*[-*+] |\s*\d+[.)] |>|\s*---+$)/.test(lines[i])&&!(lines[i].includes('|')&&i+1<lines.length&&/^[\s|:-]+$/.test(lines[i+1])))para.push(lines[i++]);root.append(h('p',{},inline(para.join('\n'))));
    }math.render(root);return root;
  }
  function reviewNote(note) {
    if(!note)return null;
    return h('aside',{class:'review-note'},h('span',{class:'eyebrow',text:'Note on the reference analysis'}),h('h3',{text:note.title}),
      p(note.summary),note.paragraphs.map(p),h('small',{text:'Explanatory note added after evaluation. The original question and responses are preserved.'}));
  }
  function actions(id) {
    return h('div',{class:'review-actions'},h('a',{class:'entry-btn',href:url(id,Object.keys(models)[0]),text:'Explore model answers & trajectories →'}),
      h('a',{href:'#analysis',text:'Read the failure analysis →'}));
  }
  const releaseData = () => script('data/release_analysis.js','VADE_RELEASE_ANALYSIS','finance50');
  const answerRecord = (data,task,model) => data?.answers.find(a=>a.task===task&&a.model===model);
  function findingBody(fd,types,heading=true,showTypes=true) {
    return h('article',{class:'cause-example'},
      showTypes?h('p',{class:'muted',text:fd.types.map(t=>types[t].label).join(' · ')}):null,
      heading?h('h4',{text:fd.finding}):null,
      fd.explanation?p(fd.explanation):null,
      fd.quotes.length?h('div',{class:'response-excerpts'},h('p',{class:'excerpt-label',text:'From the answer'}),fd.quotes.map(q=>h('blockquote',{},markdown(q)))):null);
  }
  function reviewBox(run) {
    if(run.grade_chain.benchmark_strict!=='FAIL')return null;
    const data=window.VADE_RELEASE_ANALYSIS?.finance50,a=answerRecord(data,tid(run.review.number),run.model);
    if(!a)return null;
    return h('div',{class:'review-note response-review'},h('span',{class:'eyebrow',text:'Why this answer fails'}),a.findings.length>1?p(a.summary):null,
      a.findings.map((fd,i)=>h('details',{class:'analysis-drawer',id:`finding-${a.task}-${a.model}-${i}`,open:a.findings.length===1},h('summary',{text:fd.finding}),findingBody(fd,data.types,false))),
      h('div',{class:'review-actions'},h('a',{href:url(a.task,a.model,'?view=grading'),text:'View evaluation →'})));
  }
  function metricStrip(run) {
    const m=run.metrics;
    return h('div',{class:'metric-strip'},[
      ['Answer length (tokens)',fmt(m.final_answer_tokens_cl100k_base)],['Model calls',fmt(m.assistant_turns)],
      ['Research tool calls',fmt(m.research_tool_calls)],['Execution time',`${fmt(m.active_elapsed_seconds/60,1)} min`],
      ['Estimated cost',m.estimated_api_cost_usd_site_prices==null?'Unavailable':usd(m.estimated_api_cost_usd_site_prices)],
    ].map(([name,value])=>h('div',{},h('span',{text:name}),h('strong',{text:value}))));
  }
  function outcome(run) {return h('div',{class:'outcome'},h('span',{text:'Evaluation result'}),pill(run.grade_chain.benchmark_strict));}
  function answer(run) {
    if(!run.completed)return h('div',{},outcome(run),p(run.availability_note),h('a',{href:url(tid(run.review.number),run.model,'?view=trajectory'),text:'View the available research steps →'}));
    return h('div',{},outcome(run),reviewBox(run),h('section',{class:'original-response',tabindex:-1},h('h3',{text:'Original response'}),markdown(run.final_answer)),h('details',{class:'raw-disclosure'},h('summary',{text:'View the original response text'}),raw(run.final_answer)));
  }
  const evaluationLabels = {
    criteria:'Required results', fatal_conditions:'Critical errors', domain_checks:'General checks', extra_findings:'Additional findings',
    assessment_validity:'Evaluation completeness', validity_reason:'Evaluation note', overall:'Overall result', summary:'Summary', audit_resolutions:'Review decisions',
    id:'Check reference', status:'Result', answer_quote:'Response excerpt', evidence:'Supporting evidence', reason:'Explanation', disposition:'Decision', linked_check_ids:'Related checks',
    key:'Check reference', ruling:'Decision', specification_conflict:'Question–criterion disagreement', better_supported:'Supported evaluation', adjudicator:'Reviewer',
    specification_conflicts:'Question–criterion disagreements', rulings:'Decisions', check:'Check', solver_model:'Model', sol_strict:'Sol: all checks', sol_core:'Sol: task-specific rubric',
    opus_strict:'Opus: all checks', opus_core:'Opus: task-specific rubric', final_strict:'Final result: all checks', final_core:'Final result: task-specific rubric', attempts:'Evaluation attempts',
    rubric_clause:'Scoring requirement', better_supported_review:'Supported evaluation', final:'Final result', strict:'All checks', core_only:'Task-specific rubric', rubric_items:'Scoring requirements', side_layer:'General checks',
    section:'Check group', final_status:'Final result', original_status:'Original result', source_anchors:'Source references', exact_quote:'Source excerpt', normalized_statement:'Interpretation',
    source_id:'Source document', fragment_id:'Passage reference', source_binding_id:'Evidence item', packet_sha256:'Question record checksum', source_role:'Source type',
    locator_detail:'Source location', scope_note:'Scope', url:'Source link', location:'Source location', finding:'Finding', use_limit:'Scope', case:'Question', fields:'Related records', index:'Check number'
  };
  const evaluationLabel = key => evaluationLabels[key] || (key.startsWith('criterion:') ? 'Scoring requirement' : key.startsWith('fatal:') ? 'Critical requirement' : key.replaceAll('_',' '));
  // Evaluator text is shown as written, minus internal references: evidence-fragment ids, archive
  // offsets, check codes and sentences about intermediate audit steps.
  const HIDDEN_KEYS=['packet_sha256','source_binding_id','fragment_id','id','key','linked_check_ids','assessment_validity','validity_reason',
    'audit_resolutions','better_supported','better_supported_review','adjudicator','solver_model','attempts','sol_strict','sol_core','opus_strict',
    'opus_core','final_core','specification_conflicts','specification_conflict','index','section'];
  const STATUS_TEXT={PASS:'Passed',FAIL:'Failed',UNRESOLVED:'Not determined',INCONCLUSIVE:'Not determined',confirmed_error:'Confirmed'};
  function cleanText(s){
    let t=String(s);
    t=t.split(/(?<=[.!?])\s+/).filter(x=>!/preliminar|audit resolution|\bwithdrawn\b|UNRESOLVED|nothing needed resolution/i.test(x)).join(' ');
    t=t.replace(/^(PASS|FAIL)\.\s*/,'');
    t=t.replace(/\(\s*[FPX]\d+[^)]*\)/g,'').replace(/\b[FPX]\d+(?:\/[FPX]?\d+)*\b/g,'');
    t=t.replace(/\b(?:frozen\s+)?(?:record|statute returns?|sequence|transcript offsets?|returns?|CDX return)\s+(?:at\s+)?(?:offsets?\s+)?\d{3,}(?:(?:,\s*|,?\s+and\s+)\d{3,})*/gi,'');
    t=t.replace(/\bf[_-][a-z0-9][a-z0-9_-]+\b/gi,'').replace(/\b(?:alt|fe|fc|a|req)_[a-z0-9_]+\b/g,'');
    t=t.replace(/\bfrozen\s+(?=[\w$])/gi,'');
    t=t.replace(/\bcalculator:\s*/gi,'Recomputed: ').replace(/\brubric atoms\b/gi,'required results').replace(/\brubric atom\b/gi,'required result')
      .replace(/\bfatal conditions\b/gi,'critical errors').replace(/\bfatal condition\b/gi,'critical error');
    return t.replace(/\s+([,.;:])/g,'$1').replace(/\(\s*[,;]?\s*\)/g,'').replace(/([,;])\s*([,;])/g,'$1').replace(/\s{2,}/g,' ').trim();
  }
  const checkName=key=>{
    const [kind,...rest]=String(key).split(':'),name=rest.join(' ').replace(/^[A-Z]:?\d*$/,'').replaceAll('_',' ').trim();
    return ({criterion:'Required result',fatal:'Critical error',side:'General check',domain:'General check',extra:'Additional finding'}[kind]||'Check')+(name&&!/^\d+$/.test(name)?`: ${name}`:'');
  };
  function judgeTree(obj,anchorChecks=false){
    if(obj==null)return null;
    if(typeof obj!=='object'){const t=cleanText(STATUS_TEXT[obj]||obj);return t?p(t):null;}
    if(Array.isArray(obj)){
      const items=obj.map((x,i)=>{const inner=judgeTree(x);return inner?h('div',{class:'judge-item'},h('span',{class:'mono muted',text:`${i+1}`}),inner):null;}).filter(Boolean);
      return items.length?h('div',{},items):null;
    }
    const rows=Object.entries(obj).filter(([k,v])=>v!=null&&v!==''&&!HIDDEN_KEYS.includes(k)&&!(Array.isArray(v)&&!v.length)
        &&!(k==='locator_detail'&&/rendered\.txt|processing record|rendered lines/.test(v))&&!(k==='source_id'&&/^src-[a-f0-9]{16}/.test(v)))
      .map(([k,v])=>{
        let dd;
        if(['status','ruling','overall','final_strict'].includes(k))dd=pill(v);
        else if(anchorChecks&&['criteria','fatal_conditions','domain_checks','extra_findings'].includes(k)&&Array.isArray(v))
          dd=h('div',{},v.map((item,i)=>h('div',{class:'judge-item',id:`check-${k}-${i}`},h('span',{class:'mono muted',text:`${i+1}`}),judgeTree(item))));
        else if(typeof v==='object')dd=judgeTree(v);
        else {const t=cleanText(STATUS_TEXT[v]||(k==='source_role'?String(v).replaceAll('_',' '):v));dd=t?markdown(t):null;}
        return dd?[h('dt',{text:k==='final_strict'?'Final result':evaluationLabel(k)}),h('dd',{},dd)]:null;
      }).filter(Boolean);
    return rows.length?h('dl',{class:'judge-record'},rows):null;
  }
  function grades(run) {
    const g=run.grade_chain,more=g.supplementary||{};
    // These five completed Gemini grades omit judge_model in the public projection;
    // their bound pipeline evaluator records explicitly request GPT-5.6 Sol.
    const recoveredGemini=run.model==='gemini-3.8-flash-high'&&[72,74,75,76,77].includes(run.review?.number);
    const judge=models[g.judge_model]||(recoveredGemini?models['gpt-5.6-sol']:'Unspecified evaluator');
    if(!g.assessment)return h('div',{},outcome(run),p('No answer was submitted; this attempt counts as failed.'));
    const opus=(more.opus||[])[0],adj=more.adjudication;
    const entries=[{name:`Evaluation · ${judge}`,status:g.assessment.overall,summary:g.resolution?.summary||g.assessment.summary,record:g.assessment,anchor:true}];
    if(opus)entries.push({name:`Evaluation · ${models['claude-opus-5-5']}`,status:opus.overall,summary:opus.summary,record:opus});
    if(adj)entries.push({name:`Final review · ${models['gpt-6.1-sol']}`,status:adj.final_strict,summary:adj.summary,
      record:{rulings:(adj.rulings||[]).map(r=>({check:checkName(r.key),ruling:r.ruling,reason:r.reason}))}});
    const panels=entries.map((entry,i)=>{entry.panel=h('details',{class:'judge-panel',id:i?`evaluation-review-${i-1}`:'evaluation-benchmark',open:i===0&&!adj},
      h('summary',{text:entry.name}),judgeTree(entry.record,!!entry.anchor)||p('No checks recorded.'));return entry.panel;});
    const settled=adj&&['PASS','FAIL'].includes(adj.final_strict);
    const note=adj?(settled?'The two evaluations reached different results. The result follows the final review of the checks on which they differed.'
      :'The two evaluations reached different results. The result follows a further review of the checks that the final review left open.')
      :opus?'Two independent evaluations reached the same result.':`Evaluated by ${judge}.`;
    const overview=h('section',{class:'evaluation-overview','aria-label':'Evaluation conclusions'},p(note),
      entries.map(entry=>h('article',{class:'evaluation-conclusion'},
        h('header',{},h('h3',{text:entry.name}),entry.status?pill(entry.status):null),
        entry.summary&&cleanText(entry.summary)?markdown(cleanText(entry.summary)):null,
        h('a',{href:'#',text:'Read evaluation details →',onclick:e=>{e.preventDefault();entry.panel.open=true;entry.panel.scrollIntoView({block:'start'});entry.panel.querySelector('summary').focus({preventScroll:true});}}))));
    return h('div',{},outcome(run),overview,panels,reviewBox(run));
  }
  async function trajectory(id,model,query) {
    const mine=++generation,d=openOverlay('trajectory');
    if(!tasks.some(t=>t.id===id)||!models[model]){d.append(subBar('Trajectories',null,null,'Task bank','#bank'),p('This task or model is not in the public release.'));return;}
    d.append(h('div',{class:'loading',text:'Loading the model response…'}));
    try{
      const [data]=await Promise.all([script(`data/results/${id}.js`,'VADE_RESULTS',id),releaseData()]);if(mine!==generation||!sourceHash(location.hash).startsWith(`#trajectory/${id}/${model}`))return;
      const run=data.models[model], mode=query.get('event')?'trajectory':query.get('view')||'answer';d.textContent='';
      const taskSelect=h('select',{'aria-label':'Question',onchange:e=>location.hash=url(e.target.value,model)},tasks.map(t=>h('option',{value:t.id,selected:t.id===id,text:`${publicId(t.id)} · ${t.title}`})));
      const modelSelect=h('select',{'aria-label':'Model',onchange:e=>location.hash=url(id,e.target.value,`?view=${mode}`)},Object.entries(models).map(([k,v])=>h('option',{value:k,selected:k===model,text:v})));
      const body=h('div',{class:'trajectory-body'});
      d.append(subBar(`Trajectories / ${id}`,null,null,'Question',`#task-${id}`),h('main',{class:'review-page'},
        h('div',{class:'eyebrow',text:'Finance · 50 public examples'}),h('h1',{text:'Model responses'}),
        h('p',{class:'review-deck',text:'Compare the models’ original responses, the sources they consulted and their evaluations.'}),
        h('div',{class:'trajectory-controls'},h('label',{},'Question',taskSelect),h('label',{},'Model',modelSelect)),
        metricStrip(run),h('details',{class:'question-drawer'},h('summary',{text:data.title}),p(data.question),reviewNote(data.reference_note)),
        h('nav',{class:'review-tabs','aria-label':'Response view'},[['answer','Response'],['trajectory',`Trajectory (${run.events})`],['grading','Evaluation'],['compare','Compare answers']].map(([k,v])=>h('a',{class:mode===k?'active':'',href:url(id,model,`?view=${k}`),'aria-current':mode===k?'page':null,text:v}))),body,
        p('Research steps show the model’s messages, tool use and retrieved information. Answer length is measured in tokens using the same counting method for every model. Tool calls exclude the final answer submission. Cost is estimated using the prices on the homepage.')));
      if(mode==='grading'){body.append(grades(run));const check=/^(criteria|fatal_conditions|domain_checks|extra_findings):(\d+)$/.exec(query.get('check')||'');if(check){const target=body.querySelector(`#check-${check[1]}-${check[2]}`);if(target){target.classList.add('selected-check');requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}}
        if(query.has('supplementary')){const extra=body.querySelector('.additional-evaluations');if(extra){extra.querySelectorAll('.judge-panel').forEach(el=>el.open=true);requestAnimationFrame(()=>extra.scrollIntoView({block:'start'}));}}
      }
      else if(mode==='compare'){
        const other=models[query.get('compare')]&&query.get('compare')!==model?query.get('compare'):Object.keys(models).find(key=>key!==model);
        const select=h('select',{'aria-label':'Comparison model',onchange:e=>location.hash=url(id,model,`?view=compare&compare=${e.target.value}`)},Object.entries(models).filter(([k])=>k!==model).map(([k,v])=>h('option',{value:k,selected:k===other,text:v})));
        body.append(h('label',{class:'compare-select'},'Compare with ',select),h('div',{class:'answer-compare'},[model,other].map(k=>h('article',{},h('h2',{text:models[k]}),h('a',{href:url(id,k,'?view=trajectory'),text:'Open this trajectory →'}),answer(data.models[k])))));
      } else if(mode==='trajectory'){
        body.append(h('div',{class:'loading',text:'Loading the research steps…'}));
        const allEvents=await script(run.trajectory,'VADE_TRACES',`${id}/${model}`);if(mine!==generation||!sourceHash(location.hash).startsWith(`#trajectory/${id}/${model}`))return;body.textContent='';
        // Framework bookkeeping (call-format retries, empty turns) is not part of the model's research.
        const events=allEvents.filter(e=>e.event!=='protocol_repair'&&!(e.event==='assistant'&&!String(e.data?.text||'').trim())
          &&!(e.event==='tool_result'&&/exactly one tool call is allowed per response/.test(String(e.data?.output||e.data?.text||''))));
        const stepNo=new Map(events.map((e,i)=>[e.sequence,i+1]));
        const filter=h('select',{'aria-label':'Step type'},[['all','All steps'],['assistant','Model text'],['tool_call','Tool calls'],['tool_result','Tool results']].map(([v,t])=>h('option',{value:v,text:t})));
        const search=h('input',{type:'search',placeholder:'Search the research steps…','aria-label':'Search trajectory'}), list=h('div',{class:'event-list'}),count=h('span',{class:'muted'});
        let limit=40;let selected=Number(query.get('event'));
        function draw(){list.textContent='';const q=search.value.toLowerCase();let filtered=events.filter(e=>(filter.value==='all'||e.event===filter.value)&&(!q||JSON.stringify(e.data).toLowerCase().includes(q)));
          count.textContent=`${filtered.length} of ${events.length} steps`;let visible=filtered.slice(0,limit);
          if(selected&&!q&&filter.value==='all'){const at=filtered.findIndex(e=>e.sequence===selected);if(at>=0&&at>=limit)visible=filtered.slice(Math.max(0,at-3),at+20);}
          visible.forEach(e=>{const data=e.data, name=data.name||'', text=data.text||data.output||data.arguments||JSON.stringify(data,null,2);
            const el=h('details',{class:`trace-event ${e.event}`,id:`event-${e.sequence}`,open:e.sequence===selected},
              h('summary',{},h('span',{class:'event-index',text:`${stepNo.get(e.sequence)}`}),h('strong',{text:({assistant:'Model text',tool_call:'Tool use',tool_result:'Tool result',protocol_repair:'Tool request retry',finish:'Completion'})[e.event] || e.event.replaceAll('_',' ')}),h('span',{class:'event-name',text:name}),h('span',{class:'event-preview',text:String(text).replace(/\s+/g,' ').slice(0,130)})),
              h('div',{class:'event-links'},h('a',{href:url(id,model,`?event=${e.sequence}`),text:'Link to this step'}),e.time?h('span',{class:'muted mono',text:e.time}):null));
            let made=false;const fill=()=>{if(made||!el.open)return;made=true;el.append(e.event==='assistant'?markdown(data.text||'(No model text was recorded for this step.)'):raw(text));};el.addEventListener('toggle',fill);fill();list.append(el);});
          if(filtered.length>visible.length)list.append(h('button',{class:'more',type:'button',text:`Show all ${filtered.length} matching steps`,onclick:()=>{query.delete('event');selected=0;limit=filtered.length;draw();}}));}
        filter.addEventListener('change',()=>{limit=40;draw();});let debounce;search.addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(draw,150);});
        body.append(outcome(run),h('div',{class:'trace-filter'},filter,search,count),list);draw();
        if(selected){const target=document.getElementById(`event-${selected}`);if(target)target.scrollIntoView({block:'center'});else body.prepend(p('This step is not available in this trajectory.'));}
      }else {body.append(answer(run));
        const finding=query.get('finding');let firstIssue=null;
        if(finding!=null){const target=document.getElementById(`finding-${id}-${model}-${finding}`);if(target){target.open=true;firstIssue=target;}}
        const target=query.get('section')==='response'?body.querySelector('.original-response'):firstIssue;
        if(target)requestAnimationFrame(()=>{target.scrollIntoView({block:'start'});if(target.matches('.original-response'))target.focus({preventScroll:true});});
      }
    }catch(e){if(mine!==generation)return;d.textContent='';d.append(subBar('Trajectories',null,null,'Task bank','#bank'),h('div',{class:'loading',text:'This response could not be loaded. Please refresh the page to try again.'}));}
  }
  function sortableTable(columns, records, {label, key=columns[0].key, direction='asc', className=''}={}) {
    let sortKey=key,sortDirection=direction;
    const body=h('tbody'),status=h('span',{class:'sr-only','aria-live':'polite'}),headers=[];
    const el=h('table',{class:`audit-table sortable-table ${className}`,'aria-label':label},
      h('thead',{},h('tr',{},columns.map(c=>{const th=h('th',{scope:'col'},h('button',{type:'button',class:'sort-button',onclick:()=>{
        sortDirection=sortKey===c.key?(sortDirection==='asc'?'desc':'asc'):(c.numeric?'desc':'asc');sortKey=c.key;draw();
      }},c.label,h('span',{class:'sort-arrow','aria-hidden':'true'})));headers.push([c,th]);return th;}))),body);
    function draw(){
      const column=columns.find(c=>c.key===sortKey),value=r=>column.value(r);
      const ordered=records.map((r,i)=>({r,i})).sort((a,b)=>{const x=value(a.r),y=value(b.r);
        if(x==null||y==null)return x==null?(y==null?a.i-b.i:1):-1;
        const diff=column.numeric?x-y:String(x).localeCompare(String(y));return diff?(sortDirection==='asc'?diff:-diff):a.i-b.i;});
      body.replaceChildren(...ordered.map(({r})=>h('tr',{'data-row-key':r.model||r.cause||r.label},columns.map(c=>h('td',{},c.render?c.render(r):c.value(r))))));
      headers.forEach(([c,th])=>{th.setAttribute('aria-sort',c.key===sortKey?(sortDirection==='asc'?'ascending':'descending'):'none');th.querySelector('.sort-arrow').textContent=c.key===sortKey?(sortDirection==='asc'?' ↑':' ↓'):' ↕';});
      status.textContent=`Sorted by ${column.label}, ${sortDirection==='asc'?'ascending':'descending'}.`;
    }
    draw();return h('div',{},h('div',{class:'audit-table-wrap'},el),status);
  }
  async function analysis() {
    const mine=++generation,d=openOverlay('analysis');d.append(h('div',{class:'loading',text:'Loading analysis…'}));
    try {
      const [data,ra]=await Promise.all([script('data/analysis.js','VADE_ANALYSIS_DATA','finance50'),releaseData()]);if(mine!==generation||location.hash!=='#analysis')return;
      const runs=data.runs,T=ra.text,types=ra.types,lookup=new Map(runs.map(r=>[`${r.number}/${r.model}`,r])),get=(n,m)=>lookup.get(`${n}/${m}`),num=id=>Number(id.slice(5));
      const ranked=ra.stats.slice().sort((a,b)=>b.passed-a.passed||a.label.localeCompare(b.label)),metricRows=new Map(data.statistics.models.map(r=>[r.model,r]));
      const typeKeys=Object.keys(types).filter(k=>ra.stats.some(s=>s.types[k]>0)),taskOf=id=>tasks.find(t=>t.id===id);
      const record=new Map(ra.answers.map(a=>[`${a.task}/${a.model}`,a]));
      const scroll=id=>{const el=document.getElementById(id);if(el.tagName==='DETAILS')el.open=true;el.tabIndex=-1;el.scrollIntoView({block:'start'});el.focus({preventScroll:true});},textButton=(text,fn)=>h('button',{type:'button',class:'text-button',text,onclick:fn});
      const answerLinks=a=>{const done=get(num(a.task),a.model)?.completed!==false;return h('div',{class:'review-actions response-actions'},h('a',{href:'#task-'+a.task,text:'Read question →'}),
        h('a',{href:url(a.task,a.model,done?'?view=answer&section=response':'?view=trajectory'),text:done?'Read answer →':'View recorded trajectory →'}),done?h('a',{href:url(a.task,a.model,'?view=grading'),text:'View evaluation →'}):null);};
      const nav=[['analysis-overview','Overview'],['analysis-records','Response map'],['analysis-types','Error types by model'],['analysis-examples','Examples of each error type'],['analysis-models','Model notes'],['analysis-answers','Failed answers'],['analysis-effort','Answer length & resource use'],['analysis-scope','Method']];
      const main=h('main',{class:'analysis-main rubric-analysis'});d.textContent='';
      d.append(subBar('Failure analysis',null,null,'Task bank','#bank'),h('div',{class:'analysis-layout'},
        h('aside',{class:'analysis-side'},h('nav',{'aria-label':'Analysis sections'},nav.map(([id,title])=>h('a',{href:'#',text:title,onclick:e=>{e.preventDefault();scroll(id);}})))),main));
      main.append(h('header',{class:'analysis-hero',id:'analysis-overview'},h('span',{class:'eyebrow',text:`Finance · ${ra.questions} public tasks`}),h('h1',{text:'Failure analysis'}),
        h('p',{class:'review-deck',text:T.deck}),h('h2',{class:'key-findings-title',text:'Key findings'}),h('ul',{class:'key-findings'},T.key_findings.map(t=>h('li',{text:t})))));

      // Response map
      const records=section('analysis-records','Response map',p(T.map_note));
      const order=h('select',{'aria-label':'Order tasks'},h('option',{value:'failures',text:'Most failed answers first'}),h('option',{value:'id',text:'Task ID'}));
      const wrap=h('div',{class:'waffle-wrap',tabindex:0,'aria-label':'Scrollable response map'}),legend=h('div',{class:'waffle-legend'}),tooltip=h('div',{class:'waffle-tooltip',role:'tooltip',id:'response-map-tooltip',hidden:true});
      const mids=ranked.map(r=>r.model);let modelSort=null,idDirection=1,activeTooltip=null;
      function drawWaffle(){
        tooltip.hidden=true;activeTooltip=null;const chosen=tasks.slice(),failCount=t=>mids.filter(m=>get(num(t.id),m).strict!=='PASS').length;
        if(modelSort){const rank={FAIL:0,UNRESOLVED:1,MISSING:2,INCOMPLETE:3,PASS:4};chosen.sort((a,b)=>(rank[get(num(a.id),modelSort.model).strict]-rank[get(num(b.id),modelSort.model).strict])*modelSort.direction||publicId(a.id).localeCompare(publicId(b.id)));}
        else if(order.value==='failures')chosen.sort((a,b)=>failCount(b)-failCount(a)||publicId(a.id).localeCompare(publicId(b.id)));else chosen.sort((a,b)=>idDirection*publicId(a.id).localeCompare(publicId(b.id)));
        const grid=h('table',{class:'waffle-grid','aria-label':'Task by model response map'},h('thead',{},h('tr',{},
          h('th',{scope:'col','aria-sort':!modelSort&&order.value==='id'?(idDirection===1?'ascending':'descending'):'none'},h('button',{type:'button',text:'Task / model'+(!modelSort&&order.value==='id'?(idDirection===1?' ↑':' ↓'):''),onclick:()=>{idDirection=!modelSort&&order.value==='id'?-idDirection:1;modelSort=null;order.value='id';drawWaffle();}})),
          mids.map(m=>h('th',{scope:'col','aria-sort':modelSort?.model===m?(modelSort.direction===1?'ascending':'descending'):'none'},h('button',{type:'button',title:`Sort tasks by ${models[m]} result`,onclick:()=>{modelSort={model:m,direction:modelSort?.model===m?-modelSort.direction:1};drawWaffle();},text:models[m]+(modelSort?.model===m?(modelSort.direction===1?' ↑':' ↓'):'')}))))),
          h('tbody',{},chosen.map(t=>h('tr',{},h('th',{scope:'row'},h('a',{href:'#task-'+t.id,title:`${publicId(t.id)} · ${t.title}`,text:`${publicId(t.id)} · ${t.title}`})),mids.map(m=>{
            const r=get(num(t.id),m),a=record.get(`${t.id}/${m}`),cell=h('a',{class:`waffle-cell ${r.strict.toLowerCase()}`,href:url(t.id,m),'aria-label':`${publicId(t.id)} · ${models[m]} · ${labels[r.strict]}`,'data-task':t.id,'data-model':m,'data-status':r.strict});
            function show(){activeTooltip={cell,show};tooltip.replaceChildren(h('strong',{text:`${publicId(t.id)} · ${models[m]}`}),h('span',{text:t.title}),h('div',{class:'outcome'},pill(r.strict)),p(!r.completed?'No answer was submitted. The attempt counts as failed.':a?a.summary:'Select to read the answer, trajectory and evaluation.'));tooltip.hidden=false;cell.setAttribute('aria-describedby','response-map-tooltip');
              const rect=cell.getBoundingClientRect(),width=Math.min(360,innerWidth-24);tooltip.style.width=width+'px';tooltip.style.left=Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px';tooltip.style.top=Math.max(12,rect.top-tooltip.offsetHeight-10)+'px';}
            const hide=()=>{tooltip.hidden=true;activeTooltip=null;cell.removeAttribute('aria-describedby');};cell.addEventListener('mouseenter',show);cell.addEventListener('mouseleave',hide);cell.addEventListener('focus',show);cell.addEventListener('blur',hide);cell.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tooltip.hidden){hide();e.stopPropagation();}});return h('td',{},cell);
          })))));wrap.replaceChildren(grid);
      }
      order.addEventListener('change',()=>{modelSort=null;idDirection=1;drawWaffle();});function repositionTooltip(){if(!activeTooltip)return;const {cell,show}=activeTooltip,rect=cell.getBoundingClientRect(),box=wrap.getBoundingClientRect();if(rect.top<Math.max(52,box.top+88)||rect.bottom>Math.min(innerHeight,box.bottom)){tooltip.hidden=true;activeTooltip=null;cell.removeAttribute('aria-describedby');}else show();}
      wrap.addEventListener('scroll',repositionTooltip);d.addEventListener('scroll',repositionTooltip);
      legend.append(...Object.entries(labels).filter(([key])=>runs.some(r=>r.strict===key)).map(([key,label])=>h('span',{},h('i',{class:`waffle-key ${key.toLowerCase()}`}),label)));
      records.append(h('label',{class:'analysis-control'},'Order tasks ',order),legend,wrap,tooltip);
      for(const r of runs.filter(r=>!r.completed))records.append(p(`${models[r.model]} submitted no answer on ${publicId(tid(r.number))}${r.model==='mimo-v2.6-flash'?': the model service blocked the request, including a retry':''}. The attempt counts as failed.`));
      main.append(records);drawWaffle();

      // Error types by model
      main.append(section('analysis-types','Error types by model',p(T.types_note),
        sortableTable([{key:'model',label:'Model',value:r=>r.label,render:r=>textButton(r.label,()=>scroll('model-'+r.model))},
          {key:'passed',label:'Passed',numeric:true,value:r=>r.passed},
          {key:'failed',label:'Failed',numeric:true,value:r=>r.failed,render:r=>r.failed?textButton(String(r.failed),()=>openAnswers(r.model,'')):'0'},
          ...typeKeys.map(k=>({key:k,label:types[k].label,numeric:true,value:r=>r.types[k],render:r=>r.types[k]?textButton(String(r.types[k]),()=>openAnswers(r.model,k)):'0'}))
        ],ranked,{label:'Error types by model',key:'passed',direction:'desc',className:'model-distribution'})));

      // Examples
      const examples=section('analysis-examples','Examples of each error type',p(T.examples_note));
      for(const k of typeKeys){
        const ex=ra.examples[k],total=ra.stats.reduce((n,s)=>n+s.types[k],0);
        const article=h('article',{id:'type-'+k,class:'dimension-note'},h('h3',{text:types[k].label}),p(types[k].definition),
          h('p',{class:'muted',text:`${total} failed answer${total===1?'':'s'} across the ${ranked.length} models.`}));
        if(ex){const a=record.get(`${ex.task}/${ex.model}`);
          article.append(h('div',{class:'cause-examples'},h('article',{'data-model':a.model,'data-type':k},h('div',{class:'example-heading'},h('a',{class:'mono',href:'#task-'+a.task,text:publicId(a.task)}),h('strong',{text:models[a.model]})),
            h('p',{class:'muted',text:taskOf(a.task).title}),findingBody(a.findings[ex.finding],types,true,false),answerLinks(a))));}
        article.append(h('p',{},textButton('List all answers with this error type →',()=>openAnswers('',k))));
        examples.append(article);
      }
      main.append(examples);

      // Model notes
      const notes=section('analysis-models','Model notes',p(T.models_note));
      for(const s of ranked)notes.append(h('details',{class:'analysis-drawer',id:'model-'+s.model},h('summary',{text:`${s.label} · ${s.passed} of ${ra.questions} passed`}),
        ra.model_notes[s.model]?h('p',{},String(ra.model_notes[s.model]).split(/(FIN-\d{3})/).map((part,i)=>i%2?h('a',{href:url(sourceId(part),s.model,'?view=answer'),text:part}):part)):null,
        h('p',{class:'muted',text:typeKeys.filter(k=>s.types[k]).map(k=>`${types[k].label}: ${s.types[k]}`).join(' · ')}),
        h('p',{},textButton(`List the ${s.failed} failed answers →`,()=>openAnswers(s.model,'')))));
      main.append(notes);

      // Failed answers
      const explorer=section('analysis-answers','Failed answers',p(T.answers_note));
      const modelChoice=h('select',{'aria-label':'Model'},h('option',{value:'',text:'All models'}),ranked.map(r=>h('option',{value:r.model,text:r.label})));
      const typeChoice=h('select',{'aria-label':'Error type'},h('option',{value:'',text:'All error types'}),typeKeys.map(k=>h('option',{value:k,text:types[k].label})));
      const list=h('div',{class:'failure-list'}),count=h('p',{class:'muted','aria-live':'polite'}),pagination=h('nav',{class:'failure-pagination','aria-label':'Answer pages'});
      let page=0;const pageSize=15;
      function showAnswers(){
        const model=modelChoice.value,type=typeChoice.value;
        const selected=ra.answers.filter(a=>(!model||a.model===model)&&(!type||a.findings.some(fd=>fd.types.includes(type))));
        const pages=Math.max(1,Math.ceil(selected.length/pageSize));page=Math.min(page,pages-1);const offset=page*pageSize,visible=selected.slice(offset,offset+pageSize);
        count.textContent=`${selected.length} failed answer${selected.length===1?'':'s'}${selected.length?'; showing '+(offset+1)+'–'+(offset+visible.length):''}.`;
        list.replaceChildren(...visible.map(a=>{const kinds=[...new Set(a.findings.flatMap(fd=>fd.types))];
          const details=h('details',{class:'case-card','data-types':kinds.join(' '),'data-model':a.model,'data-task':a.task},
            h('summary',{},h('span',{class:'mono',text:publicId(a.task)}),h('strong',{text:taskOf(a.task).title}),h('span',{class:'failure-model-name',text:models[a.model]}),h('span',{class:'muted',text:kinds.map(k=>types[k].label).join(' · ')})));
          let filled=false;details.addEventListener('toggle',()=>{if(!details.open||filled)return;filled=true;append(details,[a.findings.length>1?p(a.summary):null,...a.findings.map(fd=>findingBody(fd,types)),answerLinks(a)]);});return details;}));
        if(!selected.length)list.append(p('No failed answers match these filters.'));
        const previous=h('button',{type:'button',text:'← Previous',onclick:()=>{page--;showAnswers();scroll('analysis-answers');}}),next=h('button',{type:'button',text:'Next →',onclick:()=>{page++;showAnswers();scroll('analysis-answers');}});
        previous.disabled=page===0;next.disabled=page>=pages-1;pagination.replaceChildren(previous,h('span',{text:`Page ${page+1} of ${pages}`}),next);pagination.hidden=pages===1;
      }
      function openAnswers(model,type){modelChoice.value=model;typeChoice.value=type;page=0;showAnswers();scroll('analysis-answers');}
      for(const el of [modelChoice,typeChoice])el.addEventListener('change',()=>{page=0;showAnswers();});
      explorer.append(h('div',{class:'analysis-filters'},h('label',{},'Model',modelChoice),h('label',{},'Error type',typeChoice)),count,list,pagination);main.append(explorer);showAnswers();

      // Resource use
      const metricColumns=[{key:'model',label:'Model',value:r=>r.label},{key:'answers',label:'Answers',numeric:true,value:r=>r.completed},
        ...[['final_answer_tokens_cl100k_base','Answer tokens',1,0],['assistant_turns','Turns',1,0],['research_tool_calls','Tool calls',1,0],['active_elapsed_seconds','Time (min)',60,1],['estimated_api_cost_usd_site_prices','Cost',1,'usd']].map(([key,label,scale,digits])=>({key,label,numeric:true,value:r=>r.metrics[key].median==null?null:r.metrics[key].median/scale,render:r=>{const v=r.metrics[key].median==null?null:r.metrics[key].median/scale;return digits==='usd'?usd(v):fmt(digits===0&&v!=null?Math.round(v):v,digits);}}))];
      main.append(section('analysis-effort','Answer length and resource use',p(T.effort_note),sortableTable(metricColumns,ranked.map(s=>metricRows.get(s.model)).filter(Boolean),{label:'Median answer length and resource use'})));
      main.append(h('footer',{class:'review-scope-note',id:'analysis-scope'},h('h2',{text:'Method'}),T.method.map(p)));

      saveAnalysis=()=>{analysisState={model:modelChoice.value,type:typeChoice.value,page,order:order.value,modelSort,idDirection,scrollTop:d.scrollTop,
        openCases:[...list.querySelectorAll('details[open]')].map(el=>`${el.dataset.task}/${el.dataset.model}`),
        openSections:[...main.querySelectorAll('details.analysis-drawer[open]')].map(el=>el.id)};};
      if(analysisState){const state=analysisState;modelChoice.value=state.model;typeChoice.value=state.type;page=state.page;showAnswers();
        order.value=state.order;modelSort=state.modelSort;idDirection=state.idDirection;drawWaffle();
        for(const el of list.querySelectorAll('details.case-card'))el.open=state.openCases.includes(`${el.dataset.task}/${el.dataset.model}`);
        for(const el of main.querySelectorAll('details.analysis-drawer'))el.open=state.openSections.includes(el.id);
        requestAnimationFrame(()=>requestAnimationFrame(()=>{d.scrollTop=state.scrollTop;}));
      }
    }catch(e){if(mine!==generation)return;d.textContent='';d.append(subBar('Failure analysis',null,null,'Task bank','#bank'),p(e.message));console.error(e);}
  }
  return {actions,reviewNote,route(){
    if(saveAnalysis){saveAnalysis();saveAnalysis=null;}
    if(location.hash==='#analysis'){analysis();return true;}
    const m=/^#trajectory\/([^/]+)\/([^?]+)(?:\?(.*))?$/.exec(location.hash);
    if(m){trajectory(sourceId(decodeURIComponent(m[1])),decodeURIComponent(m[2]),new URLSearchParams(m[3]||''));return true;}
    generation++;return false;
  }};
};
