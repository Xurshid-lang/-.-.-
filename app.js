'use strict';
// Настройки по умолчанию; переопределяются через config.json
let CFG={title:'Тест',questionCount:25,timeLimitMinutes:30,minCorrect:15,sheetUrl:''};

const $=id=>document.getElementById(id);
const h=(t,p,...k)=>{const e=document.createElement(t);for(const x in(p||{})){if(p[x]===null||p[x]===false)continue;if(x==='class')e.className=p[x];else if(x.startsWith('on'))e[x]=p[x];else e.setAttribute(x,p[x])}k.flat().forEach(c=>{if(c!=null)e.append(c)});return e};
const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
const shuffle=a=>{a=a.slice();for(let k=a.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[a[k],a[j]]=[a[j],a[k]]}return a};
const mount=(...n)=>{$('app').replaceChildren(...n.flat().filter(Boolean));window.scrollTo(0,0)};
const store={get:k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};

let bank=[],loaded=false,quiz=null,timer=null;
const limit=()=>CFG.timeLimitMinutes*60;
const prep=q=>({...q,opts:shuffle(q.o.map((x,i)=>({t:x,ok:i===q.a})))});
const isRight=(q,a)=>a>=0&&q.opts[a].ok;

function sendResult(r){
  if(!CFG.sheetUrl)return;
  try{fetch(CFG.sheetUrl,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify(r)}).catch(()=>{})}catch(e){}
}

function pickQuestions(){
  const key=q=>q.q.toLowerCase(),N=CFG.questionCount;
  const uniq=[...new Map(bank.map(q=>[key(q),q])).values()];
  let seen=new Set();
  try{seen=new Set(JSON.parse(store.get('seenQ')||'[]'))}catch(e){}
  const fresh=uniq.filter(q=>!seen.has(key(q)));
  let pick;
  if(fresh.length>=N)pick=shuffle(fresh).slice(0,N);
  else{pick=shuffle([...fresh,...shuffle(uniq.filter(q=>seen.has(key(q)))).slice(0,N-fresh.length)]);seen=new Set()}
  pick.forEach(q=>seen.add(key(q)));
  store.set('seenQ',JSON.stringify([...seen]));
  return pick;
}

function viewStart(){
  if(!loaded)return mount(h('h1',{},CFG.title),h('p',{class:'hint'},'Загружаю вопросы…'));
  if(!bank.length)return mount(h('h1',{},CFG.title),h('div',{class:'card'},h('p',{},'Не удалось загрузить вопросы. Проверьте, что questions.txt лежит рядом с index.html и сайт открыт по http(s), а не как файл.')));
  const n=Math.min(CFG.questionCount,bank.length);
  const inp=h('input',{class:'name',placeholder:'Фамилия и имя',maxlength:'60',value:store.get('sname'),autocomplete:'name'});
  const grp=h('input',{class:'name',placeholder:'Группа',maxlength:'30',value:store.get('sgroup'),autocomplete:'off'});
  const prac=h('input',{type:'checkbox',id:'prac'});
  const go=()=>{const nm=inp.value.trim();if(!nm){inp.focus();return}store.set('sname',nm);store.set('sgroup',grp.value.trim());startQuiz(nm,grp.value.trim(),null,prac.checked)};
  inp.onkeydown=grp.onkeydown=e=>{if(e.key==='Enter')go()};
  mount(h('h1',{},CFG.title),h('div',{class:'card'},
    h('div',{class:'chips'},h('span',{},n+' вопросов'),h('span',{},CFG.timeLimitMinutes+' минут'),h('span',{},'Для сдачи: минимум '+CFG.minCorrect)),
    h('p',{class:'hint'},'Выберите вариант и нажмите «Далее»: сразу увидите, верно ли ответили. Пока не нажали «Далее», ответ можно изменить.'),
    inp,grp,
    h('label',{class:'chk',for:'prac'},prac,'Тренировка (без таймера и без отправки результата)'),
    h('button',{class:'primary big',onclick:go},'Начать тест')));
}

function startQuiz(name,group,list,practice){
  const qs=(list||pickQuestions()).map(prep);
  quiz={active:true,name,group,practice,qs,ans:qs.map(()=>-1),done:qs.map(()=>false),i:0,end:Date.now()+limit()*1000,left:limit()};
  clearInterval(timer);
  if(!practice)timer=setInterval(()=>{ // считаем по часам, а не по тикам: вкладка в фоне не сбивает время
    quiz.left=Math.max(0,Math.ceil((quiz.end-Date.now())/1000));
    document.querySelectorAll('.timer').forEach(e=>{e.textContent=fmt(quiz.left);e.classList.toggle('low',quiz.left<=60)});
    if(quiz.left<=0)finish();
  },500);
  renderQ();
}

function renderQ(){
  const{qs,i,ans,done}=quiz,q=qs[i],last=i===qs.length-1,isDone=done[i];
  const right=q.opts.find(o=>o.ok).t,good=isDone&&isRight(q,ans[i]);
  const low=!quiz.practice&&quiz.left<=60?' low':'';
  const tm=cls=>quiz.practice?null:h('span',{class:cls+low,role:'timer','aria-label':'Оставшееся время'},fmt(quiz.left));
  const nums=qs.map((_,n)=>{
    let c='';
    if(done[n])c=isRight(qs[n],ans[n])?'r':'w';else if(ans[n]>=0)c='has';
    if(n===i)c+=' cur';
    return h('button',{class:c.trim(),title:'Вопрос '+(n+1),'aria-label':'Вопрос '+(n+1),'aria-current':n===i?'true':null,onclick:()=>{quiz.i=n;renderQ()}},String(n+1));
  });
  const side=h('div',{class:'side'},h('div',{class:'card'},tm('timer'),
    h('div',{class:'nums'},nums),
    h('p',{class:'legend'},'Зелёный: верно · Красный: неверно · Закрашен: выбран ответ'),
    h('button',{style:'width:100%',onclick:()=>{
      const left=qs.filter((_,n)=>!done[n]).length;
      if(left===0||confirm('Не проверено вопросов: '+left+'. Завершить тест?'))finish();
    }},'Завершить тест')));
  const main=h('div',{},tm('timer mtimer'),h('div',{class:'card'},
    h('p',{class:'cnt'},'Вопрос '+(i+1)+' из '+qs.length),
    h('div',{class:'bar'},h('i',{style:'width:'+((i+1)/qs.length*100)+'%'})),
    h('p',{class:'q'},q.q),
    q.opts.map((o,k)=>{
      let c='opt';
      if(isDone){c+=' locked';if(o.ok)c+=' right';else if(ans[i]===k)c+=' wrong'}
      else if(ans[i]===k)c+=' sel';
      return h('button',{class:c,'aria-pressed':ans[i]===k?'true':'false',onclick:()=>{if(quiz.done[i])return;quiz.ans[i]=k;renderQ()}},o.t);
    }),
    h('div',{'aria-live':'polite'},isDone?h('div',{class:'fb '+(good?'ok':'bad')},
      good?'Верно!':(ans[i]<0?'Ответа нет. ':'Неверно. ')+'Правильный ответ: '+right,
      q.ex?h('p',{class:'ex'},q.ex):null):null),
    h('div',{class:'nav'},
      h('button',{disabled:i===0?'':null,onclick:()=>{if(quiz.i>0){quiz.i--;renderQ()}}},'Назад'),
      isDone
        ?h('button',{class:'primary',onclick:()=>{last?finish():(quiz.i++,renderQ())}},last?'Завершить':'Следующий вопрос')
        :h('button',{class:'primary',disabled:ans[i]<0?'':null,onclick:()=>{if(quiz.ans[i]<0)return;quiz.done[i]=true;renderQ()}},'Далее'))));
  mount(h('div',{class:'layout'},main,side));
}

function finish(){
  if(!quiz||!quiz.active)return;
  clearInterval(timer);quiz.active=false;
  const{qs,ans}=quiz,spent=quiz.practice?0:limit()-quiz.left;
  let ok=0;const items=[],wrongQs=[],wrongIdx=[];
  qs.forEach((q,n)=>{
    const right=q.opts.find(o=>o.ok).t,has=ans[n]>=0,g=isRight(q,ans[n]);
    if(g)ok++;else{wrongQs.push(q);wrongIdx.push(q.id)}
    items.push(h('div',{class:'item '+(g?'ok':'bad')},
      h('span',{class:'tag'},g?'Верно':'Неверно'),h('p',{},(n+1)+'. '+q.q),
      h('small',{},'Ваш ответ: '+(has?q.opts[ans[n]].t:'нет ответа')),
      g?null:h('small',{},'Правильный ответ: '+right),
      q.ex?h('small',{},'Пояснение: '+q.ex):null));
  });
  const wrong=qs.length-ok,pct=Math.round(ok/qs.length*100),passed=ok>=CFG.minCorrect;
  if(!quiz.practice)sendResult({name:quiz.name,group:quiz.group,ok,wrong,total:qs.length,pct,passed,time:fmt(spent),wrongIdx});
  const{name,group,practice}=quiz;
  mount(h('div',{class:'card'},h('h2',{style:'margin-top:0'},'Результат теста'),
    h('div',{class:'stats'},h('div',{},h('b',{},ok+'/'+qs.length),h('span',{},'Результат')),h('div',{},h('b',{},pct+'%'),h('span',{},'Процент')),h('div',{},h('b',{},practice?'—':fmt(spent)),h('span',{},'Время'))),
    h('p',{},'Правильных ответов: '+ok+' · Неправильных ответов: '+wrong),
    practice?null:h('div',{class:'verdict '+(passed?'ok':'bad')},passed?'Тест сдан':'Тест не сдан: нужно минимум '+CFG.minCorrect+' правильных ответов')),
    h('div',{class:'row'},
      wrongQs.length?h('button',{class:'primary',onclick:()=>startQuiz(name,group,wrongQs,true)},'Повторить ошибки ('+wrongQs.length+')'):null,
      h('button',{onclick:()=>{quiz=null;viewStart()}},'Пройти заново')),
    h('h2',{},'Разбор всех вопросов'),items);
}
window.addEventListener('beforeunload',e=>{if(quiz&&quiz.active&&!quiz.practice){e.preventDefault();e.returnValue=''}});

// Формат строки: вопрос | вариант1 | вариант2 | ... | номер_верного [| ~пояснение]
function parseQs(txt){
  const out=[];
  txt.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).forEach((line,id)=>{
    const p=line.split('|').map(s=>s.trim());
    let ex='';if(p.length&&p[p.length-1].startsWith('~'))ex=p.pop().slice(1).trim();
    const a=parseInt(p[p.length-1],10),o=p.slice(1,-1);
    if(p.length<4||o.some(x=>!x)||!(a>=1&&a<=o.length))return;
    out.push({id:id+1,q:p[0],o,a:a-1,ex});
  });
  return out;
}

viewStart();
fetch('config.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
  .then(c=>{CFG={...CFG,...c};document.title='Тест: '+CFG.title;return fetch('questions.txt',{cache:'no-store'})})
  .then(r=>r.ok?r.text():'').then(t=>{bank=parseQs(t.replace(/^\uFEFF/,'').replace(/\r/g,''))})
  .catch(()=>{}).finally(()=>{loaded=true;if(!quiz)viewStart()});
