const SUPABASE_URL = "https://mwerulfadajqwiynpcdw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZXJ1bGZhZGFqcXdpeW5wY2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NDkxNjAsImV4cCI6MjA5MjMyNTE2MH0.i4k0Uz_IRR3Yk6ycp-RkwkvsGXPxNtWjNdQM1pJ7I_4";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);// ============================================================
//  PharmaDist Pro — Frontend App (Server-Connected)
//  API Backend: http://localhost:5000/api
// ============================================================
const API = 'http://localhost:5000/api';

// API helper
async function apiFetch(path, opts={}) {
  try {
    const res = await fetch(API + path, {
      headers: {'Content-Type':'application/json'},
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    return await res.json();
  } catch(e) {
    console.error('API error:', path, e);
    return null;
  }
}
async function apiGet(path) { return apiFetch(path); }
async function apiPost(path, body) { return apiFetch(path, {method:'POST', body}); }
async function apiPut(path, body) { return apiFetch(path, {method:'PUT', body}); }
async function apiDel(path) { return apiFetch(path, {method:'DELETE'}); }

const A = {
  st:{user:null,role:null,page:'login',params:{},filt:{},charts:{}},
  data:{pharmacies:[],drugs:[],orders:[],bills:[],returns:[],tickets:[],notifs:[],chats:[],dist:{}},

  async init(){
    // Load distributor info
    const dist = await apiGet('/dist');
    if (dist) this.data.dist = dist;

    // Auto-login as Admin (skip login page)
    const res = await apiPost('/login', {role:'admin', email:'admin@pharmadist.com', password:'admin123'});
    if (res?.ok) {
      this.st.user = res.user;
      this.st.role = res.role;
      this.st.page = 'dashboard';
      await this.loadAll();
    }
    this.render();
  },

  async loadAll(){
    // Load all data for current role
    const [phs, ords, bills, rets, tks, notifs, chats] = await Promise.all([
      apiGet('/pharmacies'),
      apiGet('/orders'),
      apiGet('/bills'),
      apiGet('/returns'),
      apiGet('/tickets'),
      apiGet('/notifs?role='+this.st.role+(this.st.user?.phId?'&phId='+this.st.user.phId:'')),
      apiGet('/chats')
    ]);
    if (phs) this.data.pharmacies = phs;
    if (ords) this.data.orders = ords;
    if (bills) this.data.bills = bills;
    if (rets) this.data.returns = rets;
    if (tks) this.data.tickets = tks;
    if (notifs) this.data.notifs = notifs;
    if (chats) this.data.chats = chats.map(c=>({from:c.from_role,text:c.text,time:c.time}));
    if (this.st.role === 'pharmacy' && this.st.user?.phId) {
      const drugs = await apiGet('/drugs?phId='+this.st.user.phId);
      if (drugs) this.data.drugs = drugs;
    } else {
      const drugs = await apiGet('/drugs');
      if (drugs) this.data.drugs = drugs;
    }
  },

  save(){/* Data is saved to server on each action */},

  async login(role){
    const em = Q('#lem')?.value.trim(), pw = Q('#lpw')?.value.trim();
    if (!em || !pw) { this.toast('Enter email and password','err'); return; }
    this.toast('Signing in…','ok');
    const res = await apiPost('/login', {role, email:em, password:pw});
    if (!res) { this.toast('Server error – is the backend running?','err'); return; }
    if (res.ok) {
      this.st.user = res.user;
      this.st.role = res.role;
      this.st.page = 'dashboard';
      this.toast('Loading data…','ok');
      await this.loadAll();
      this.render();
      this.toast('Welcome, '+res.user.name+'!','ok');
    } else {
      this.toast(res.msg || 'Invalid credentials','err');
    }
  },

  logout(){
    if (!confirm('Log out?')) return;
    this.killCharts();
    this.closeModal();
    const np = Q('#np'); if (np) np.classList.remove('open');
    this.st.user=null; this.st.role=null; this.st.page='login';
    this.st.filt={}; this.st.params={};
    this.data={pharmacies:[],drugs:[],orders:[],bills:[],returns:[],tickets:[],notifs:[],chats:[],dist:this.data.dist};
    this.render();
  },

  nav(p){this.killCharts();this.closeModal();this.st.page=p;this.renderPage();QA('.ni').forEach(e=>e.classList.toggle('active',e.dataset.page===p));if(window.innerWidth<900)this.closeSidebar();},
  setState(k,v){const keys=k.split('.');let o=this;for(let i=0;i<keys.length-1;i++)o=o[keys[i]];o[keys[keys.length-1]]=v;},
  killCharts(){Object.values(this.st.charts).forEach(c=>{try{c.destroy();}catch{}});this.st.charts={};},


  
  render(){
    const app=Q('#app');
    if(this.st.page==='login'){app.innerHTML=this.rLogin();this.attachLogin();}
    else{app.innerHTML=this.rShell();this.renderPage();this.updateNDot();}
  },
  renderPage(){
    const el=Q('#pc');if(!el)return;
    const pg=this.st.page,role=this.st.role;
    const mp={admin:{dashboard:()=>this.rAdminDash(),pharmacies:()=>this.rPharmacies(),documentation:()=>this.rAdminDocs(),orders:()=>this.rAdminOrders(),subscriptions:()=>this.rSubs(),billing:()=>this.rAdminBilling(),returns:()=>this.rAdminReturns(),support:()=>this.rAdminSupport()},pharmacy:{dashboard:()=>this.rPhDash(),inventory:()=>this.rInventory(),orders:()=>this.rPhOrders(),documentation:()=>this.rPhDocs(),billing:()=>this.rPhBilling(),subscriptions:()=>this.rPhSubs(),returns:()=>this.rPhReturns(),support:()=>this.rPhSupport()}};
    el.innerHTML=(mp[role]?.[pg]||mp[role]?.dashboard)();
    setTimeout(()=>{if(pg==='dashboard'){role==='admin'?this.chartAdmin():this.chartPh();}},50);
  },

  rLogin(){
    return`<div class="login-page"><div class="lbg"></div><div class="lcard">
    <div class="llogo"><div class="licon"><span class="material-icons-round">local_pharmacy</span></div><div><div class="lh">PharmaDist Pro</div><span class="ls">Distributor · Pharmacy Management</span></div></div>
    <div class="ltabs"><button class="ltab active" id="tab-a" onclick="A.fillDemo('admin')"><span class="material-icons-round">admin_panel_settings</span>Admin</button><button class="ltab" id="tab-p" onclick="A.fillDemo('pharmacy')"><span class="material-icons-round">storefront</span>Pharmacy</button></div>
    <div class="fg"><label>Email</label><input id="lem" type="email" placeholder="Enter email" value="admin@pharmadist.com"></div>
    <div class="fg"><label>Password</label><input id="lpw" type="password" placeholder="Password" value="admin123" onkeypress="if(event.key==='Enter')A.login(A._lr||'admin')"></div>
    <button class="btn btn-p btn-lg" style="width:100%;justify-content:center;margin-top:6px" onclick="A.login(A._lr||'admin')"><span class="material-icons-round">login</span>Sign In</button>
    <div class="demo-row"><button class="demo-btn" onclick="A.fillDemo('admin')">⚡ Admin Demo</button><button class="demo-btn" onclick="A.fillDemo('pharmacy')">⚡ Pharmacy Demo</button></div>
    <div class="lfeats"><div class="lfeat"><span class="material-icons-round">inventory_2</span><span>Smart Inventory</span></div><div class="lfeat"><span class="material-icons-round">sync</span><span>Real-time Sync</span></div><div class="lfeat"><span class="material-icons-round">receipt_long</span><span>Auto Billing</span></div><div class="lfeat"><span class="material-icons-round">notifications_active</span><span>Smart Alerts</span></div></div>
    </div></div>`;
  },
  _lr:'admin',
  attachLogin(){Q('#lpw')?.addEventListener('keypress',e=>{if(e.key==='Enter')this.login(this._lr);});},
  fillDemo(r){
    this._lr=r;Q('#tab-a').classList.toggle('active',r==='admin');Q('#tab-p').classList.toggle('active',r==='pharmacy');
    Q('#lem').value=r==='admin'?'admin@pharmadist.com':'citypharma@demo.com';
    Q('#lpw').value=r==='admin'?'admin123':'pharmacy123';
  },

  rShell(){
    const a=this.st.role==='admin';
    const nav=a?this.navAdmin():this.navPh();
    const uc=this.getNotifs().filter(n=>!n.read).length;
    return`<div class="shell">
    <aside class="sidebar" id="sb"><div class="sl"><div class="si"><span class="material-icons-round">local_pharmacy</span></div><div class="slt"><h2>PharmaDist Pro</h2><span>${a?'Distributor Panel':'Pharmacy Panel'}</span></div></div>
    <nav class="snav">${nav}</nav>
    <div class="sf"><div class="su"><div class="sav">${this.st.user.init}</div><div class="sui"><div class="name">${this.st.user.name}</div><div class="role">${a?'Distributor Admin':'Pharmacy Manager'}</div></div><button title="Logout" style="background:none;border:none;cursor:pointer;color:var(--mute);padding:4px" onclick="A.logout()"><span class="material-icons-round" style="font-size:17px">logout</span></button></div></div></aside>
    <header class="hdr"><button class="hib" id="mb" onclick="A.toggleSb()"><span class="material-icons-round">menu</span></button><div class="htitle" id="ht">Dashboard</div><div class="hsrch"><span class="material-icons-round si-icon">search</span><input type="text" placeholder="Search..."></div>
    <div class="hact"><button class="hib" onclick="A.toggleNP()" title="Notifications" style="position:relative"><span class="material-icons-round">notifications</span>${uc>0?'<span class="ndot"></span>':''}</button><button class="hib btn-er" onclick="A.logout()" title="Logout"><span class="material-icons-round">logout</span></button></div></header>
    <main class="main" id="pc"></main></div>`;
  },

  navAdmin(){
    const d=this.data;const po=d.orders.filter(o=>o.type==='inventory'&&o.status==='pending').length;const pr=d.returns.filter(r=>r.status==='pending').length;const ub=d.bills.filter(b=>b.status==='unpaid').length;
    return this.navSec('Overview',[{p:'dashboard',i:'dashboard',l:'Dashboard'},{p:'pharmacies',i:'storefront',l:'Pharmacies'}])+this.navSec('Operations',[{p:'documentation',i:'description',l:'Documentation'},{p:'orders',i:'shopping_cart',l:'Orders',b:po||undefined}])+this.navSec('Finance',[{p:'subscriptions',i:'card_membership',l:'Subscriptions'},{p:'billing',i:'receipt_long',l:'Billing',b:ub||undefined},{p:'returns',i:'assignment_return',l:'Returns',b:pr||undefined}])+this.navSec('Help',[{p:'support',i:'support_agent',l:'Support'}]);
  },
  navPh(){
    const phId=this.st.user.phId;const d=this.data;
    const ls=d.drugs.filter(g=>g.phId===phId&&g.qty<=g.min).length;const po=d.orders.filter(o=>o.phId===phId&&o.type==='inventory'&&o.status==='pending').length;const ub=d.bills.filter(b=>b.phId===phId&&b.status==='unpaid').length;
    return this.navSec('Overview',[{p:'dashboard',i:'dashboard',l:'Dashboard'},{p:'inventory',i:'inventory_2',l:'Inventory',b:ls||undefined}])+this.navSec('Operations',[{p:'orders',i:'shopping_cart',l:'Orders',b:po||undefined},{p:'documentation',i:'description',l:'Documentation'}])+this.navSec('Finance',[{p:'billing',i:'receipt_long',l:'Billing',b:ub||undefined},{p:'subscriptions',i:'card_membership',l:'Subscription'},{p:'returns',i:'assignment_return',l:'Returns'}])+this.navSec('Help',[{p:'support',i:'support_agent',l:'Support'}]);
  },
  navSec(label,items){return`<div class="snl">${label}</div>${items.map(it=>`<a class="ni${this.st.page===it.p?' active':''}" data-page="${it.p}" onclick="A.nav('${it.p}');A.setHT('${it.l}')">${'<span class="material-icons-round">'+it.i+'</span>'}<span class="nil">${it.l}</span>${it.b?'<span class="nb">'+it.b+'</span>':''}</a>`).join('')}`;},
  setHT(t){const e=Q('#ht');if(e)e.textContent=t;},
  toggleSb(){Q('#sb')?.classList.toggle('open');Q('#sov')?.classList.toggle('vis');},
  closeSidebar(){Q('#sb')?.classList.remove('open');Q('#sov')?.classList.remove('vis');},

  getNotifs(){const r=this.st.role,ph=this.st.user?.phId;return this.data.notifs.filter(n=>r==='admin'?n.admin:!n.admin&&(!n.ph||n.ph===ph));},
  updateNDot(){const c=this.getNotifs().filter(n=>!n.read).length;const d=Q('.ndot');if(d)d.style.display=c>0?'block':'none';},
  toggleNP(){
    const np=Q('#np');const open=np.classList.contains('open');
    if(open){np.classList.remove('open');return;}
    const ns=this.getNotifs();np.innerHTML=`<div class="nph"><h3>Notifications (${ns.filter(n=>!n.read).length} new)</h3><div style="display:flex;gap:6px"><button class="btn btn-sm btn-s" onclick="A.markAllRead()">Mark read</button><button class="btn btn-sm btn-s" onclick="A.toggleNP()"><span class="material-icons-round" style="font-size:17px">close</span></button></div></div><div class="nl2">${ns.length===0?'<div class="empty"><span class="material-icons-round">notifications_none</span><h3>No notifications</h3></div>':ns.map(n=>`<div class="nitem${n.read?'':' unread'}" onclick="A.markRead('${n.id}')"><div class="nt ${n.type}">${n.type}</div><div class="nm">${n.msg}</div><div class="nd">${n.date}</div></div>`).join('')}</div>`;
    np.classList.add('open');ns.forEach(n=>n.read=true);this.save();this.updateNDot();
  },
  async markAllRead(){this.getNotifs().forEach(n=>n.read=true);await apiPost('/notifs/read-all',{role:this.st.role,phId:this.st.user?.phId});this.toggleNP();this.updateNDot();},
  markRead(id){const n=this.data.notifs.find(n=>n.id===id);if(n)n.read=true;this.save();},
  async addNotif(type,msg,admin,ph=null){const n={id:'n'+Date.now(),type,msg,date:new Date().toLocaleDateString('en-IN'),read:false,admin,ph};this.data.notifs.unshift(n);await apiPost('/notifs',{type,msg,admin,ph,date:n.date});this.updateNDot();},

  toast(msg,type='ok',sub=''){
    const icons={ok:'check_circle',err:'error',warn:'warning'};
    const t=document.createElement('div');t.className=`toast ${type}`;
    t.innerHTML=`<span class="material-icons-round">${icons[type]||'info'}</span><div class="ttxt"><strong>${msg}</strong>${sub?`<span>${sub}</span>`:''}</div>`;
    Q('#toast').appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(38px)';setTimeout(()=>t.remove(),280);},3000);
  },
  showModal(title,body,foot='',size=''){
    Q('#mc').innerHTML=`<div class="mo" onclick="event.target===this&&A.closeModal()"><div class="mdl${size?' '+size:''}"><div class="mh"><h2>${title}</h2><button class="btn btn-icon btn-s" onclick="A.closeModal()"><span class="material-icons-round">close</span></button></div><div class="mb2">${body}</div>${foot?`<div class="mf">${foot}</div>`:''}</div></div>`;
  },
  closeModal(){Q('#mc').innerHTML='';},

  fmt(n){return(+n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});},
  sbadge(s){const m={active:'b-ok Active',pending:'b-warn Pending',delivered:'b-ok Delivered',approved:'b-info Approved',pending__ord:'b-warn Pending',rejected:'b-err Rejected',paid:'b-ok Paid',unpaid:'b-err Unpaid',open:'b-warn Open',closed:'b-ok Closed',suspended:'b-err Suspended'};const k=s==='pending'?'b-warn Pending':m[s]||'b-gray '+s;const[cls,...rest]=k.split(' ');return`<span class="badge ${cls}">${rest.join(' ')}</span>`;},

  // ===== ADMIN DASHBOARD =====
  rAdminDash(){
    const d=this.data;const tr=d.bills.filter(b=>b.status==='paid').reduce((s,b)=>s+b.amt,0);const tu=d.bills.filter(b=>b.status==='unpaid').reduce((s,b)=>s+b.amt,0);const ap=d.pharmacies.filter(p=>p.status==='active').length;const po=d.orders.filter(o=>o.type==='inventory'&&o.status==='pending').length;
    return`<div class="ph"><div class="pt"><h1>Distributor Dashboard</h1><p>Overview of your distribution network.</p></div><div class="pa"><button class="btn btn-s" onclick="A.addPharmacyModal()"><span class="material-icons-round">add</span>Add Pharmacy</button><button class="btn btn-p" onclick="A.nav('orders')"><span class="material-icons-round">shopping_cart</span>View Orders</button></div></div>
    <div class="sg"><div class="sc p"><div class="sic p"><span class="material-icons-round">storefront</span></div><div><div class="sv">${d.pharmacies.length}</div><div class="sl2">Total Pharmacies</div><div class="scc up">↑ ${ap} Active</div></div></div><div class="sc c"><div class="sic c"><span class="material-icons-round">currency_rupee</span></div><div><div class="sv">₹${this.fmt(tr)}</div><div class="sl2">Total Revenue</div><div class="scc up">+₹${this.fmt(tu)} pending</div></div></div><div class="sc o"><div class="sic o"><span class="material-icons-round">pending_actions</span></div><div><div class="sv">${po}</div><div class="sl2">Pending Orders</div><div class="scc">${d.orders.filter(o=>o.type==='inventory').length} total</div></div></div><div class="sc g"><div class="sic r"><span class="material-icons-round">assignment_return</span></div><div><div class="sv">${d.returns.filter(r=>r.status==='pending').length}</div><div class="sl2">Pending Returns</div><div class="scc">${d.returns.length} total</div></div></div></div>
    <div class="cr"><div class="card"><div class="ch"><h3>Revenue Overview</h3><span class="badge b-ok">Live</span></div><div class="cc"><canvas id="rc"></canvas></div></div><div class="card"><div class="ch"><h3>Orders by Status</h3></div><div class="cc"><canvas id="oc"></canvas></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px"><div class="card"><div class="ch"><h3>Recent Orders</h3><button class="btn btn-sm btn-s" onclick="A.nav('orders')">View All</button></div><div class="tw"><table><thead><tr><th>ID</th><th>Pharmacy</th><th>Total</th><th>Status</th></tr></thead><tbody>${d.orders.filter(o=>o.type==='inventory').slice(0,5).map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}</td><td>${o.phName}</td><td>₹${this.fmt(o.tot)}</td><td>${this.sbadge(o.status)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><div class="ch"><h3>Alerts</h3><span class="badge b-err">${po+d.returns.filter(r=>r.status==='pending').length} Actions</span></div><div class="cb"><div class="al">${po>0?`<div class="ai warning"><span class="material-icons-round ai-icon">shopping_cart</span><div class="ai-txt"><strong>${po} Pending Order(s)</strong><span>Review and approve incoming orders</span></div><button class="btn btn-sm btn-warn" onclick="A.nav('orders')">View</button></div>`:''}<div class="ai info"><span class="material-icons-round ai-icon">people</span><div class="ai-txt"><strong>${ap} Active Pharmacies</strong><span>₹${this.fmt(tu)} pending collection</span></div></div></div></div></div></div>
    <div class="card"><div class="ch"><h3>Pharmacy Overview</h3><button class="btn btn-sm btn-s" onclick="A.nav('pharmacies')">Manage All</button></div><div class="tw"><table><thead><tr><th>Name</th><th>License</th><th>Contact</th><th>Plan</th><th>Status</th><th>Actions</th></tr></thead><tbody>${d.pharmacies.map(p=>`<tr><td>${p.name}</td><td style="font-family:monospace;font-size:.8rem">${p.license}</td><td>${p.contact}</td><td>${p.plan?`<span class="badge b-acc">₹${p.plan}/mo</span>`:'<span class="badge b-gray">None</span>'}</td><td>${this.sbadge(p.status)}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.phDetail('${p.id}')">View</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
  },
  chartAdmin(){
    const d=this.data;const c1=Q('#rc')?.getContext('2d');
    if(c1)this.st.charts.r=new Chart(c1,{type:'line',data:{labels:['Nov','Dec','Jan','Feb','Mar','Apr'],datasets:[{label:'Revenue',data:[45000,62000,78000,55000,89000,Math.round(d.bills.filter(b=>b.status==='paid').reduce((s,b)=>s+b.amt,0))],borderColor:'#6C63FF',backgroundColor:'rgba(108,99,255,.12)',borderWidth:2,fill:true,tension:.4,pointBackgroundColor:'#6C63FF'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4'}},y:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4',callback:v=>'₹'+v}}}}});
    const c2=Q('#oc')?.getContext('2d');if(c2){const inv=d.orders.filter(o=>o.type==='inventory');this.st.charts.o=new Chart(c2,{type:'doughnut',data:{labels:['Pending','Approved','Delivered'],datasets:[{data:[inv.filter(o=>o.status==='pending').length,inv.filter(o=>o.status==='approved').length,inv.filter(o=>o.status==='delivered').length],backgroundColor:['#FFB547','#3B82F6','#00D48E'],borderColor:'#0E1826',borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7B9CC4',padding:16}}},cutout:'65%'}});}
  },

  // ===== ADMIN PHARMACIES =====
  rPharmacies(){
    const d=this.data;return`<div class="ph"><div class="pt"><h1>Pharmacies</h1><p>All registered pharmacies.</p></div><button class="btn btn-p" onclick="A.addPharmacyModal()"><span class="material-icons-round">add</span>Register</button></div>
    <div class="fb"><button class="fbtn active" onclick="A.fph(this,'all')">All (${d.pharmacies.length})</button><button class="fbtn" onclick="A.fph(this,'active')">Active (${d.pharmacies.filter(p=>p.status==='active').length})</button><button class="fbtn" onclick="A.fph(this,'pending')">Pending (${d.pharmacies.filter(p=>p.status==='pending').length})</button></div>
    <div class="phg" id="phg">${d.pharmacies.map(p=>this.phCard(p)).join('')}</div>`;
  },
  phCard(p){return`<div class="phcard" data-s="${p.status}"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><div class="pha">${p.name[0]}</div><div style="flex:1"><div style="font-weight:700;color:var(--txt)">${p.name}</div><div style="font-size:.72rem;color:var(--mute);font-family:monospace">${p.license}</div></div>${this.sbadge(p.status)}</div><div class="phdet"><div><span class="material-icons-round">location_on</span>${p.address}</div><div><span class="material-icons-round">phone</span>${p.contact}</div><div><span class="material-icons-round">email</span>${p.email}</div><div><span class="material-icons-round">calendar_today</span>Joined ${p.joined}</div></div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--bdr)"><div>${p.plan?`<span class="badge b-acc">₹${p.plan}/mo</span>${p.waived?'<span class="badge b-ok" style="margin-left:4px">Waived</span>':''}`: '<span class="badge b-gray">No Plan</span>'}</div><div style="display:flex;gap:6px"><button class="btn btn-sm btn-s" onclick="A.phDetail('${p.id}')">View</button><button class="btn btn-sm btn-p" onclick="A.editPhModal('${p.id}')">Edit</button></div></div></div>`;},
  fph(btn,s){QA('.fbtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');QA('.phcard').forEach(c=>{c.style.display=(s==='all'||c.dataset.s===s)?'':'none';});},

  addPharmacyModal(){
    this.showModal('Register New Pharmacy',`<div class="fr"><div class="fg"><label>Pharmacy Name *</label><input id="pn" placeholder="Name"></div><div class="fg"><label>License Number *</label><input id="pl" placeholder="e.g. KAR-PH-2024-001"></div></div><div class="fg"><label>Address</label><textarea id="pa" placeholder="Full address"></textarea></div><div class="fr"><div class="fg"><label>Contact *</label><input id="pc2" type="tel" placeholder="+91 XXXXX XXXXX"></div><div class="fg"><label>Email *</label><input id="pe" type="email" placeholder="pharmacy@email.com"></div></div><div class="fr"><div class="fg"><label>Password</label><input id="pp" value="pharma123"></div><div class="fg"><label>Plan</label><select id="pplan"><option value="">No Plan</option><option value="1000">₹1000/mo – Paid Delivery</option><option value="1300">₹1500/mo – Free Delivery</option></select></div></div><div class="upl" onclick="this.querySelector('input').click()"><span class="material-icons-round">upload_file</span><p>Upload Past Bills</p><p><span>Browse files</span></p><input type="file" multiple accept=".pdf,.jpg,.png" style="display:none"></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.savePharmacy()"><span class="material-icons-round">save</span>Register</button>`);
  },
  async savePharmacy(){
    const name=Q('#pn')?.value.trim(),lic=Q('#pl')?.value.trim(),cont=Q('#pc2')?.value.trim(),em=Q('#pe')?.value.trim();
    if(!name||!lic||!cont||!em){this.toast('Fill all required fields','err');return;}
    const res=await apiPost('/pharmacies',{name,license:lic,address:Q('#pa')?.value.trim()||'',contact:cont,email:em,password:Q('#pp')?.value||'pharma123',plan:Q('#pplan')?.value||null,planExpiry:Q('#pplan')?.value?'2026-12-31':null,status:'active',joined:new Date().toLocaleDateString('en-CA'),docs:[]});if(res?.ok){const phs=await apiGet('/pharmacies');if(phs)this.data.pharmacies=phs;}this.closeModal();this.toast(name+' registered!','ok');this.nav('pharmacies');
  },
  editPhModal(id){
    const p=this.data.pharmacies.find(ph=>ph.id===id);if(!p)return;
    this.showModal('Edit: '+p.name,`<div class="fr"><div class="fg"><label>Name</label><input id="en" value="${p.name}"></div><div class="fg"><label>License</label><input id="el" value="${p.license}"></div></div><div class="fg"><label>Address</label><textarea id="ea">${p.address}</textarea></div><div class="fr"><div class="fg"><label>Contact</label><input id="ec" value="${p.contact}"></div><div class="fg"><label>Email</label><input id="ee" value="${p.email}"></div></div><div class="fr"><div class="fg"><label>Status</label><select id="es"><option value="active"${p.status==='active'?' selected':''}>Active</option><option value="pending"${p.status==='pending'?' selected':''}>Pending</option><option value="suspended"${p.status==='suspended'?' selected':''}>Suspended</option></select></div><div class="fg"><label>Plan</label><select id="ep2"><option value="">No Plan</option><option value="1000"${p.plan==='1000'?' selected':''}>₹1000/mo – Paid Delivery</option><option value="1300"${p.plan==='1300'?' selected':''}>₹1500/mo – Free Delivery</option></select></div></div><div class="fg" style="flex-direction:row;align-items:center;gap:10px;border:1px solid var(--bdr);padding:12px;border-radius:var(--rs);background:var(--inp)"><input type="checkbox" id="ew"${p.waived?' checked':''} style="width:auto"><label for="ew" style="margin-bottom:0;cursor:pointer">Waive subscription fee</label></div>`,
    `<button class="btn btn-er btn-sm" onclick="A.delPh('${id}')">Delete</button><button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.updPh('${id}')">Update</button>`);
  },
  updPh(id){const p=this.data.pharmacies.find(ph=>ph.id===id);if(!p)return;p.name=Q('#en').value;p.license=Q('#el').value;p.address=Q('#ea').value;p.contact=Q('#ec').value;p.email=Q('#ee').value;p.status=Q('#es').value;p.plan=Q('#ep2').value||null;p.waived=Q('#ew').checked;this.save();this.closeModal();this.toast('Updated!','ok');this.nav('pharmacies');},
  delPh(id){if(!confirm('Delete pharmacy?'))return;this.data.pharmacies=this.data.pharmacies.filter(p=>p.id!==id);this.save();this.closeModal();this.toast('Deleted','warn');this.nav('pharmacies');},
  phDetail(id){
    const p=this.data.pharmacies.find(ph=>ph.id===id);if(!p)return;const bills=this.data.bills.filter(b=>b.phId===id);const spent=bills.filter(b=>b.status==='paid').reduce((s,b)=>s+b.amt,0);
    this.showModal(p.name+' – Details',`<div class="ic" style="margin-bottom:16px"><div class="icg"><div class="if"><label>Name</label><span>${p.name}</span></div><div class="if"><label>License</label><span style="font-family:monospace">${p.license}</span></div><div class="if"><label>Contact</label><span>${p.contact}</span></div><div class="if"><label>Email</label><span>${p.email}</span></div><div class="if" style="grid-column:1/-1"><label>Address</label><span>${p.address}</span></div><div class="if"><label>Plan</label><span>${p.plan?`₹${p.plan}/mo${p.waived?' (Waived)':''}`:'-'}</span></div><div class="if"><label>Status</label><span>${this.sbadge(p.status)}</span></div></div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px"><div class="sc c" style="flex-direction:column;text-align:center;padding:14px"><div class="sv">${this.data.orders.filter(o=>o.phId===id&&o.type==='inventory').length}</div><div class="sl2">Orders</div></div><div class="sc g" style="flex-direction:column;text-align:center;padding:14px"><div class="sv">₹${this.fmt(spent)}</div><div class="sl2">Spent</div></div><div class="sc o" style="flex-direction:column;text-align:center;padding:14px"><div class="sv">${bills.filter(b=>b.status==='unpaid').length}</div><div class="sl2">Unpaid Bills</div></div></div><h4 style="margin-bottom:10px;color:var(--txt2)">Documents</h4>${p.docs.length>0?p.docs.map(d=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:6px"><span class="material-icons-round" style="color:var(--err)">picture_as_pdf</span><span style="flex:1;font-size:.875rem;color:var(--txt)">${d.name}</span><span style="font-size:.72rem;color:var(--mute)">${d.size} · ${d.date}</span></div>`).join(''):'<p style="color:var(--mute)">No documents yet</p>'}`,
    `<button class="btn btn-s" onclick="A.closeModal()">Close</button><button class="btn btn-p" onclick="A.closeModal();A.editPhModal('${id}')">Edit</button>`,'mdl-lg');
  },

  // ===== ADMIN DOCS =====
  rAdminDocs(){
    const d=this.data;return`<div class="ph"><div class="pt"><h1>Documentation</h1><p>Pharmacy registration documents & bills.</p></div><button class="btn btn-p" onclick="A.addPharmacyModal()"><span class="material-icons-round">add</span>Register Pharmacy</button></div>
    ${d.pharmacies.map(p=>`<div class="card" style="margin-bottom:14px"><div class="ch"><div style="display:flex;align-items:center;gap:10px"><div class="pha" style="width:34px;height:34px;font-size:.9rem;border-radius:9px">${p.name[0]}</div><div><div style="font-weight:700;color:var(--txt)">${p.name}</div><div style="font-size:.72rem;color:var(--mute)">${p.license} · ${p.address}</div></div></div><div style="display:flex;gap:7px;align-items:center">${this.sbadge(p.status)}<button class="btn btn-sm btn-s" onclick="A.addDocModal('${p.id}')"><span class="material-icons-round">upload_file</span>Upload</button></div></div><div class="cb"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px"><div class="if"><label>Pharmacy Name</label><span>${p.name}</span></div><div class="if"><label>License</label><span style="font-family:monospace">${p.license}</span></div><div class="if"><label>Contact</label><span>${p.contact}</span></div><div class="if"><label>Email</label><span>${p.email}</span></div><div class="if" style="grid-column:1/-1"><label>Address</label><span>${p.address}</span></div></div><div style="padding-top:10px;border-top:1px solid var(--bdr)"><div style="font-size:.8rem;font-weight:600;color:var(--mute);margin-bottom:8px">Documents</div>${p.docs.length>0?`<div style="display:flex;flex-wrap:wrap;gap:7px">${p.docs.map(doc=>`<div style="display:flex;align-items:center;gap:7px;padding:7px 11px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs)"><span class="material-icons-round" style="font-size:17px;color:var(--err)">picture_as_pdf</span><span style="font-size:.8rem;color:var(--txt)">${doc.name}</span><span style="font-size:.72rem;color:var(--mute)">${doc.size}</span></div>`).join('')}</div>`:'<div style="color:var(--mute);font-size:.875rem">No documents</div>'}</div></div></div>`).join('')}`;
  },
  addDocModal(phId){
    this.showModal('Upload Document',`<div class="fg"><label>Document Name</label><input id="dn" placeholder="e.g. Drug License 2024.pdf"></div><div class="upl" onclick="document.getElementById('df').click()"><span class="material-icons-round">cloud_upload</span><p>PDF, JPG or PNG</p><p><span>Click to browse</span></p><input type="file" id="df" accept=".pdf,.jpg,.png" style="display:none" onchange="Q('#dfn').textContent=this.files[0]?.name||''"></div><div id="dfn" style="font-size:.8rem;color:var(--acc);margin-top:7px"></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.saveDoc('${phId}')">Upload</button>`);
  },
  async saveDoc(phId){const name=Q('#dn')?.value.trim();if(!name){this.toast('Enter document name','err');return;}const p=this.data.pharmacies.find(ph=>ph.id===phId);if(!p)return;p.docs.push({id:'doc'+Date.now(),name,date:new Date().toLocaleDateString('en-CA'),size:Math.floor(Math.random()*400+100)+' KB'});this.save();this.closeModal();this.toast('Uploaded!','ok');this.nav('documentation');},

  // ===== ADMIN ORDERS =====
  rAdminOrders(){
    const ords=this.data.orders.filter(o=>o.type==='inventory');const f=this.st.filt.ao||'all';const list=f==='all'?ords:ords.filter(o=>o.status===f);
    return`<div class="ph"><div class="pt"><h1>Pharmacy Orders</h1><p>Bulk orders placed by pharmacies.</p></div></div>
    <div class="fb">${['all','pending','approved','delivered'].map(s=>`<button class="fbtn${f===s?' active':''}" onclick="A.setState('st.filt.ao','${s}');A.nav('orders')">${s.charAt(0).toUpperCase()+s.slice(1)} (${s==='all'?ords.length:ords.filter(o=>o.status===s).length})</button>`).join('')}</div>
    ${list.length===0?'<div class="empty"><span class="material-icons-round">shopping_cart</span><h3>No orders found</h3></div>':''}
    ${list.length>0?`<div class="card"><div class="tw"><table><thead><tr><th>Order ID</th><th>Pharmacy</th><th>Drugs</th><th>Date</th><th>Total</th><th>Delivery</th><th>Status</th><th>Actions</th></tr></thead><tbody>${list.map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}</td><td>${o.phName}</td><td><div style="max-width:180px">${o.drugs.map(d=>`<div style="font-size:.8rem">${d.name} <span style="color:var(--acc)">×${d.qty}</span></div>`).join('')}</div></td><td>${o.date}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(o.tot)}</td><td>${o.del==='free'?'<span class="badge b-ok">Free</span>':'<span class="badge b-gray">Paid</span>'}</td><td>${this.sbadge(o.status)}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.vOrder('${o.id}')">View</button>${o.status==='pending'?`<button class="btn btn-sm btn-ok" onclick="A.approveOrd('${o.id}')">Approve</button>`:''}${o.status==='approved'?`<button class="btn btn-sm btn-p" onclick="A.deliverOrd('${o.id}')">Deliver</button>`:''}</div></td></tr>`).join('')}</tbody></table></div></div>`:''}`;
  },
  async approveOrd(id){const o=this.data.orders.find(o=>o.id===id);if(!o)return;await apiPut('/orders/'+id,{status:'approved'});o.status='approved';this.addNotif('order','Order '+id+' approved!',false,o.phId);this.toast(id+' approved!','ok');this.nav('orders');},
  async deliverOrd(id){const o=this.data.orders.find(o=>o.id===id);if(!o)return;await apiPut('/orders/'+id,{status:'delivered'});o.status='delivered';if(!o.billed){await this.genBill(id,true);}this.addNotif('order','Order '+id+' delivered!',false,o.phId);this.toast(id+' delivered!','ok');this.nav('orders');},
  async genBill(ordId,silent=false){const o=this.data.orders.find(o=>o.id===ordId);if(!o||o.billed)return;const b={id:'BILL-'+Date.now(),phId:o.phId,phName:o.phName,ordId,amt:o.tot,date:new Date().toLocaleDateString('en-CA'),due:new Date(Date.now()+15*864e5).toLocaleDateString('en-CA'),status:'unpaid',type:'bulk',paid:null};this.data.bills.push(b);o.billed=true;this.save();if(!silent){this.addNotif('payment','Bill '+b.id+' – ₹'+this.fmt(b.amt),false,o.phId);this.toast('Bill generated!','ok');}},
  vOrder(id){
    const o=this.data.orders.find(o=>o.id===id);if(!o)return;
    this.showModal('Order – '+o.id,`<div class="ic" style="margin-bottom:14px"><div class="icg"><div class="if"><label>Order ID</label><span style="font-family:monospace">${o.id}</span></div><div class="if"><label>Date</label><span>${o.date}</span></div><div class="if"><label>Pharmacy</label><span>${o.phName}</span></div><div class="if"><label>Status</label><span>${this.sbadge(o.status)}</span></div><div class="if"><label>Delivery</label><span>${o.del==='free'?'Free':'Paid'}</span></div><div class="if"><label>Notes</label><span>${o.notes||'—'}</span></div></div></div><table><thead><tr><th>Drug</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${o.drugs.map(d=>`<tr><td>${d.name}</td><td>${d.qty}</td><td>₹${d.up.toFixed(2)}</td><td>₹${d.tot.toFixed(2)}</td></tr>`).join('')}<tr><td colspan="3" style="text-align:right;font-weight:700">Subtotal</td><td>₹${o.sub.toFixed(2)}</td></tr><tr><td colspan="3" style="text-align:right;font-weight:700">GST (5%)</td><td>₹${o.gst.toFixed(2)}</td></tr><tr><td colspan="3" style="text-align:right;font-weight:800;color:var(--txt)">Total</td><td style="font-weight:800;color:var(--acc)">₹${this.fmt(o.tot)}</td></tr></tbody></table>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Close</button>${o.status==='pending'?`<button class="btn btn-ok" onclick="A.closeModal();A.approveOrd('${o.id}')">Approve</button>`:''}`);
  },

  // ===== ADMIN SUBSCRIPTIONS =====
  rSubs(){
    const d=this.data;return`<div class="ph"><div class="pt"><h1>Subscriptions</h1><p>Manage pharmacy subscription plans.</p></div></div>
    <div class="plans"><div class="plan"><div style="font-size:.8rem;font-weight:700;color:var(--mute);text-transform:uppercase;margin-bottom:7px">Basic Plan</div><div class="pp"><sup>₹</sup>1000</div><div class="per">per month</div><ul class="pf"><li><span class="material-icons-round">check_circle</span>Unlimited Orders</li><li><span class="material-icons-round">check_circle</span>Paid Delivery</li><li><span class="material-icons-round">check_circle</span>Order Tracking</li><li><span class="material-icons-round">check_circle</span>Priority Support</li></ul><div style="font-size:.8rem;color:var(--mute)">${d.pharmacies.filter(p=>p.plan==='1000').length} subscribed</div></div><div class="plan feat"><div style="font-size:.8rem;font-weight:700;color:var(--acc);text-transform:uppercase;margin-bottom:7px">Premium Plan</div><div class="pp" style="color:var(--acc)"><sup>₹</sup>1500</div><div class="per">per month</div><ul class="pf"><li><span class="material-icons-round">check_circle</span>Unlimited Orders</li><li><span class="material-icons-round">check_circle</span>FREE Delivery</li><li><span class="material-icons-round">check_circle</span>Priority Processing</li><li><span class="material-icons-round">check_circle</span>Dedicated Support</li><li><span class="material-icons-round">check_circle</span>Analytics</li></ul><div style="font-size:.8rem;color:var(--mute)">${d.pharmacies.filter(p=>p.plan==='1500').length} subscribed</div></div></div>
    <div class="card"><div class="ch"><h3>Pharmacy Subscriptions</h3></div><div class="tw"><table><thead><tr><th>Pharmacy</th><th>Plan</th><th>Expiry</th><th>Waived</th><th>Status</th><th>Actions</th></tr></thead><tbody>${d.pharmacies.map(p=>`<tr><td>${p.name}</td><td>${p.plan?`<span class="badge b-acc">₹${p.plan}/mo</span>`:'<span class="badge b-gray">None</span>'}</td><td>${p.planExpiry||'—'}</td><td>${p.waived?'<span class="badge b-ok">Yes</span>':'—'}</td><td>${this.sbadge(p.status)}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.editPhModal('${p.id}')">Manage</button><button class="btn btn-sm ${p.waived?'btn-warn':'btn-ok'}" onclick="A.toggleWaive('${p.id}')">${p.waived?'Remove Waive':'Waive Fee'}</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
  },
  async toggleWaive(id){const res=await apiPost('/pharmacies/'+id+'/waive',{});const p=this.data.pharmacies.find(ph=>ph.id===id);if(p&&res)p.waived=res.waived;this.toast(p?.waived?'Fee waived for '+p?.name:'Waiver removed','ok');this.nav('subscriptions');},

  // ===== ADMIN BILLING =====
  rAdminBilling(){
    const b=this.data.bills;const tp=b.filter(x=>x.status==='paid').reduce((s,x)=>s+x.amt,0);const tu=b.filter(x=>x.status==='unpaid').reduce((s,x)=>s+x.amt,0);
    return`<div class="ph"><div class="pt"><h1>Billing</h1><p>All pharmacy bills and payments.</p></div><button class="btn btn-p" onclick="A.newBillModal()"><span class="material-icons-round">add</span>Create Bill</button></div>
    <div class="sg" style="grid-template-columns:repeat(3,1fr)"><div class="sc g"><div class="sic g"><span class="material-icons-round">check_circle</span></div><div><div class="sv">₹${this.fmt(tp)}</div><div class="sl2">Collected</div></div></div><div class="sc o"><div class="sic o"><span class="material-icons-round">pending_actions</span></div><div><div class="sv">₹${this.fmt(tu)}</div><div class="sl2">Pending</div></div></div><div class="sc p"><div class="sic p"><span class="material-icons-round">receipt_long</span></div><div><div class="sv">${b.length}</div><div class="sl2">Total Bills</div></div></div></div>
    <div class="card"><div class="ch"><h3>All Bills</h3><select onchange="A.fBills(this.value)" style="padding:5px 11px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs);color:var(--txt);font-family:inherit"><option value="all">All</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></div><div class="tw"><table id="bt"><thead><tr><th>Bill ID</th><th>Pharmacy</th><th>Order</th><th>Amount</th><th>Date</th><th>Due</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>${b.map(x=>`<tr data-s="${x.status}"><td style="font-family:monospace;font-size:.8rem">${x.id}</td><td>${x.phName}</td><td style="font-family:monospace;font-size:.8rem">${x.ordId}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(x.amt)}</td><td>${x.date}</td><td>${x.due}</td><td><span class="badge b-gray">${x.type}</span></td><td>${x.status==='paid'?'<span class="badge b-ok">Paid</span>':'<span class="badge b-err">Unpaid</span>'}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.vBill('${x.id}')">View</button>${x.status==='unpaid'?`<button class="btn btn-sm btn-ok" onclick="A.markPaid('${x.id}')">Mark Paid</button>`:''}</div></td></tr>`).join('')}</tbody></table></div></div>`;
  },
  fBills(s){QA('#bt tbody tr').forEach(r=>{r.style.display=(s==='all'||r.dataset.s===s)?'':'none';});},
  async markPaid(id){const b=this.data.bills.find(b=>b.id===id);if(!b)return;const paid=new Date().toLocaleDateString('en-CA');await apiPut('/bills/'+id,{status:'paid',paid});b.status='paid';b.paid=paid;this.toast('Bill '+id+' marked paid!','ok');this.nav('billing');},
  newBillModal(){
    this.showModal('Create Manual Bill',`<div class="fg"><label>Pharmacy</label><select id="nb-ph">${this.data.pharmacies.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div><div class="fr"><div class="fg"><label>Amount (₹)</label><input id="nb-amt" type="number" min="0" step="0.01" placeholder="0.00"></div><div class="fg"><label>Type</label><select id="nb-type"><option value="individual">Individual</option><option value="bulk">Bulk</option></select></div></div><div class="fr"><div class="fg"><label>Bill Date</label><input id="nb-d" type="date" value="${new Date().toLocaleDateString('en-CA')}"></div><div class="fg"><label>Due Date</label><input id="nb-due" type="date" value="${new Date(Date.now()+15*864e5).toLocaleDateString('en-CA')}"></div></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.saveManualBill()">Create</button>`);
  },
  saveManualBill(){const phId=Q('#nb-ph')?.value,amt=parseFloat(Q('#nb-amt')?.value);if(!phId||!amt){this.toast('Fill all fields','err');return;}const ph=this.data.pharmacies.find(p=>p.id===phId);this.data.bills.push({id:'BILL-'+Date.now(),phId,phName:ph.name,ordId:'MANUAL',amt,date:Q('#nb-d').value,due:Q('#nb-due').value,status:'unpaid',type:Q('#nb-type').value,paid:null});this.save();this.closeModal();this.toast('Bill created!','ok');this.nav('billing');},
  vBill(id){
    const b=this.data.bills.find(b=>b.id===id);if(!b)return;
    this.showModal('Bill – '+b.id,`<div style="font-family:monospace;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--r);padding:20px"><div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><div style="font-size:1.25rem;font-weight:800;color:var(--acc)">PharmaDist Pro</div><div style="font-size:.8rem;color:var(--txt2)">${this.data.dist.address}</div><div style="font-size:.8rem;color:var(--txt2)">GST: ${this.data.dist.gst}</div></div><div style="text-align:right"><div style="font-size:1.25rem;font-weight:800">TAX INVOICE</div><div style="color:var(--mute)">${b.id}</div><div style="margin-top:4px">${b.status==='paid'?'<span class="badge b-ok" style="font-size:.875rem">PAID</span>':'<span class="badge b-err" style="font-size:.875rem">UNPAID</span>'}</div></div></div><div style="border-top:1px solid var(--bdr);padding-top:14px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Billed To:</span><span style="font-weight:700">${b.phName}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Date:</span><span>${b.date}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Due:</span><span>${b.due}</span></div>${b.paid?`<div style="display:flex;justify-content:space-between"><span>Paid on:</span><span style="color:var(--ok)">${b.paid}</span></div>`:''}</div><div style="text-align:right;font-size:1.5rem;font-weight:800;color:var(--acc)">Total: ₹${this.fmt(b.amt)}</div></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Close</button><button class="btn btn-s" onclick="A.printBill('${b.id}')"><span class="material-icons-round">print</span>Print</button>${b.status==='unpaid'?`<button class="btn btn-ok" onclick="A.closeModal();A.markPaid('${b.id}')">Mark Paid</button>`:''}`)
  },

  // ===== ADMIN RETURNS =====
  rAdminReturns(){
    const rets=this.data.returns;const f=this.st.filt.ar||'all';const list=f==='all'?rets:rets.filter(r=>r.status===f);
    return`<div class="ph"><div class="pt"><h1>Return Requests</h1><p>Pharmacy drug return requests.</p></div></div>
    <div class="fb">${['all','pending','approved','rejected'].map(s=>`<button class="fbtn${f===s?' active':''}" onclick="A.setState('st.filt.ar','${s}');A.nav('returns')">${s.charAt(0).toUpperCase()+s.slice(1)} (${s==='all'?rets.length:rets.filter(r=>r.status===s).length})</button>`).join('')}</div>
    ${list.length===0?'<div class="empty"><span class="material-icons-round">assignment_return</span><h3>No returns found</h3></div>':''}
    ${list.map(r=>`<div class="card" style="margin-bottom:14px"><div class="ch"><div><span style="font-family:monospace;font-size:.875rem;color:var(--acc)">${r.id}</span><span style="margin-left:10px;font-size:.875rem;color:var(--mute)">from ${r.phName}</span></div><div style="display:flex;gap:7px;align-items:center"><span class="badge ${r.reason==='expired'?'b-err':r.reason==='damaged'?'b-warn':'b-info'}">${r.reason}</span>${this.sbadge(r.status)}</div></div><div class="cb"><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px"><div><div style="font-size:.72rem;color:var(--mute);margin-bottom:7px">DRUGS</div>${r.drugs.map(d=>`<div style="display:flex;justify-content:space-between;padding:7px;background:var(--inp);border-radius:var(--rs);margin-bottom:4px"><span style="color:var(--txt)">${d.name}</span><span style="color:var(--acc)">×${d.qty}</span>${d.batch?`<span style="color:var(--mute);font-size:.72rem">${d.batch}</span>`:''}</div>`).join('')}</div><div><div style="font-size:.72rem;color:var(--mute);margin-bottom:4px">Notes</div><p style="font-size:.875rem">${r.notes}</p>${r.anote?`<div style="margin-top:7px;padding:7px;background:var(--okL);border-radius:var(--rs);color:var(--ok);font-size:.8rem">Admin: ${r.anote}</div>`:''}</div></div>${r.status==='pending'?`<div style="display:flex;gap:7px;align-items:flex-end;border-top:1px solid var(--bdr);padding-top:14px"><div style="flex:1"><label style="font-size:.72rem;color:var(--mute);display:block;margin-bottom:4px">Admin Note</label><input id="an-${r.id}" placeholder="Note for pharmacy…" style="margin-bottom:0"></div><button class="btn btn-ok" onclick="A.procRet('${r.id}','approved')"><span class="material-icons-round">check</span>Approve</button><button class="btn btn-er" onclick="A.procRet('${r.id}','rejected')"><span class="material-icons-round">close</span>Reject</button></div>`:''}</div></div>`).join('')}`;
  },
  async procRet(id,status){const r=this.data.returns.find(r=>r.id===id);if(!r)return;const anote=Q('#an-'+id)?.value||'';await apiPut('/returns/'+id,{status,anote});r.status=status;r.anote=anote;this.addNotif('return','Return '+id+' '+status,false,r.phId);this.toast('Return '+status+'!',status==='approved'?'ok':'warn');this.nav('returns');},

  // ===== ADMIN SUPPORT =====
  rAdminSupport(){
    const d=this.data;const tks=d.tickets;
    return`<div class="ph"><div class="pt"><h1>Support Center</h1><p>Manage pharmacy support tickets.</p></div></div>
    <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:22px"><div class="card cb" style="text-align:center;border-color:var(--info)"><span class="material-icons-round" style="font-size:34px;color:var(--info)">phone</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">${d.dist.phone}</div><div style="color:var(--mute);font-size:.8rem">Call Support</div><a href="tel:${d.dist.phone}" class="btn btn-p" style="margin-top:10px;display:inline-flex">Call Now</a></div><div class="card cb" style="text-align:center;border-color:var(--ok)"><span class="material-icons-round" style="font-size:34px;color:var(--ok)">email</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">${d.dist.email}</div><div style="color:var(--mute);font-size:.8rem">Email Support</div><a href="mailto:${d.dist.email}" class="btn btn-ok" style="margin-top:10px;display:inline-flex">Send Email</a></div><div class="card cb" style="text-align:center;border-color:var(--acc)"><span class="material-icons-round" style="font-size:34px;color:var(--acc)">chat</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">Live Chat</div><div style="color:var(--mute);font-size:.8rem">Chat Support</div><button class="btn btn-p" style="margin-top:10px" onclick="A.chatModal(false)">Open Chat</button></div></div>
    <div class="card"><div class="ch"><h3>Support Tickets</h3><span class="badge b-warn">${tks.filter(t=>t.status==='open').length} Open</span></div>${tks.length===0?'<div class="empty"><span class="material-icons-round">support_agent</span><h3>No tickets</h3></div>':`<div class="tw"><table><thead><tr><th>ID</th><th>Pharmacy</th><th>Subject</th><th>Type</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${tks.map(t=>`<tr><td style="font-family:monospace">${t.id}</td><td>${t.phName}</td><td>${t.subject}</td><td>${t.type}</td><td>${t.date}</td><td>${t.status==='open'?'<span class="badge b-warn">Open</span>':'<span class="badge b-ok">Closed</span>'}</td><td><button class="btn btn-sm btn-s" onclick="A.vTicket('${t.id}')">Respond</button></td></tr>`).join('')}</tbody></table></div>`}</div>`;
  },
  vTicket(id){
    const t=this.data.tickets.find(t=>t.id===id);if(!t)return;
    this.showModal('Ticket – '+t.id,`<div style="margin-bottom:12px"><span class="badge b-gray">${t.type}</span><span style="margin-left:7px;font-size:.8rem;color:var(--mute)">from ${t.phName} · ${t.date}</span></div><div class="chat"><div class="chatm" id="tmsg">${t.msgs.map(m=>`<div class="cmsg ${m.from==='support'?'sent':'recv'}"><div>${m.text}</div><div class="ct">${m.time}</div></div>`).join('')}</div><div class="chatin"><input type="text" id="tr" placeholder="Reply…" onkeypress="if(event.key==='Enter')A.replyTk('${id}')"><button class="btn btn-p" onclick="A.replyTk('${id}')"><span class="material-icons-round">send</span></button></div></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Close</button>${t.status==='open'?`<button class="btn btn-ok" onclick="A.closeTk('${id}')">Close Ticket</button>`:''}`);
    setTimeout(()=>{const m=Q('#tmsg');if(m)m.scrollTop=m.scrollHeight;},100);
  },
  replyTk(id){const t=this.data.tickets.find(t=>t.id===id);const inp=Q('#tr');if(!t||!inp?.value.trim())return;const msg={from:'support',text:inp.value.trim(),time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})};t.msgs.push(msg);inp.value='';this.save();const m=Q('#tmsg');if(m){m.innerHTML+=`<div class="cmsg sent"><div>${msg.text}</div><div class="ct">${msg.time}</div></div>`;m.scrollTop=m.scrollHeight;}},
  closeTk(id){const t=this.data.tickets.find(t=>t.id===id);if(t)t.status='closed';this.save();this.closeModal();this.toast('Ticket closed','ok');this.nav('support');},
  chatModal(fromPh){
    this.showModal('Live Chat Support',`<div class="chat" style="height:360px"><div class="chatm" id="cm">${this.data.chats.map(m=>`<div class="cmsg ${m.from==='support'?'sent':'recv'}"><div>${m.text}</div><div class="ct">${m.time}</div></div>`).join('')}</div><div class="chatin"><input type="text" id="ci" placeholder="Type message…" onkeypress="if(event.key==='Enter')A.sendChat(${fromPh})"><button class="btn btn-p" onclick="A.sendChat(${fromPh})"><span class="material-icons-round">send</span></button></div></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Close</button>`);
    setTimeout(()=>{const m=Q('#cm');if(m)m.scrollTop=m.scrollHeight;},100);
  },
  sendChat(fromPh){
    const inp=Q('#ci');if(!inp?.value.trim())return;
    const msg={from:fromPh?'pharmacy':'support',text:inp.value.trim(),time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})};
    this.data.chats.push(msg);this.save();inp.value='';
    const m=Q('#cm');if(m){m.innerHTML+=`<div class="cmsg ${fromPh?'recv':'sent'}"><div>${msg.text}</div><div class="ct">${msg.time}</div></div>`;m.scrollTop=m.scrollHeight;}
    if(fromPh){setTimeout(()=>{const r={from:'support',text:"Thank you! Our team will respond shortly. For urgent help call "+this.data.dist.phone,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})};this.data.chats.push(r);this.save();const m2=Q('#cm');if(m2){m2.innerHTML+=`<div class="cmsg sent"><div>${r.text}</div><div class="ct">${r.time}</div></div>`;m2.scrollTop=m2.scrollHeight;}},1500);}
  },

  // ===== PHARMACY DASHBOARD =====
  rPhDash(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId);const today=new Date();
    const exp=drugs.filter(d=>{const e=new Date(d.exp);return e>today&&(e-today)/864e5<=30;});const expired=drugs.filter(d=>new Date(d.exp)<today);const low=drugs.filter(d=>d.qty<=d.min);
    const ords=this.data.orders.filter(o=>o.phId===phId);const bills=this.data.bills.filter(b=>b.phId===phId);const ph=this.data.pharmacies.find(p=>p.id===phId);
    return`<div class="ph"><div class="pt"><h1>${ph?.name||'Dashboard'}</h1><p>Welcome back! Here's your pharmacy overview.</p></div><div class="pa"><button class="btn btn-s" onclick="A.nav('inventory')"><span class="material-icons-round">inventory_2</span>Inventory</button><button class="btn btn-p" onclick="A.placeOrderModal()"><span class="material-icons-round">shopping_cart</span>Order from Distributor</button></div></div>
    <div class="sg"><div class="sc p"><div class="sic p"><span class="material-icons-round">medication</span></div><div><div class="sv">${drugs.length}</div><div class="sl2">Total Drugs</div><div class="scc up">${drugs.reduce((s,d)=>s+d.qty,0)} units</div></div></div><div class="sc o"><div class="sic o"><span class="material-icons-round">warning</span></div><div><div class="sv">${low.length}</div><div class="sl2">Low Stock</div><div class="scc dn">${expired.length} Expired</div></div></div><div class="sc g"><div class="sic g"><span class="material-icons-round">shopping_cart</span></div><div><div class="sv">${ords.filter(o=>o.type==='inventory').length}</div><div class="sl2">Inventory Orders</div><div class="scc">${ords.filter(o=>o.type==='inventory'&&o.status==='pending').length} Pending</div></div></div><div class="sc c"><div class="sic c"><span class="material-icons-round">receipt_long</span></div><div><div class="sv">₹${this.fmt(bills.filter(b=>b.status==='unpaid').reduce((s,b)=>s+b.amt,0))}</div><div class="sl2">Outstanding Bills</div><div class="scc">${bills.filter(b=>b.status==='unpaid').length} bills</div></div></div></div>
    ${(exp.length>0||low.length>0||expired.length>0)?`<div class="card" style="margin-bottom:22px;border-color:rgba(255,181,71,.4)"><div class="ch" style="border-color:rgba(255,181,71,.2)"><h3 style="color:var(--warn)">⚠️ Smart Alerts</h3><span class="badge b-warn">${exp.length+low.length+expired.length} Issues</span></div><div class="cb"><div class="al">${expired.map(d=>`<div class="ai danger"><span class="material-icons-round ai-icon">error</span><div class="ai-txt"><strong>${d.name} – EXPIRED</strong><span>Expiry: ${d.exp} · Qty: ${d.qty}</span></div><button class="btn btn-sm btn-er" onclick="A.returnModal()">Return</button></div>`).join('')}${exp.map(d=>{const days=Math.round((new Date(d.exp)-today)/864e5);return`<div class="ai warning"><span class="material-icons-round ai-icon">schedule</span><div class="ai-txt"><strong>${d.name} – Expiring in ${days} days</strong><span>Expiry: ${d.exp} · Qty: ${d.qty}</span></div><button class="btn btn-sm btn-warn" onclick="A.returnModal()">Return</button></div>`}).join('')}${low.map(d=>`<div class="ai danger"><span class="material-icons-round ai-icon">inventory_2</span><div class="ai-txt"><strong>${d.name} – Low Stock (${d.qty} left)</strong><span>Min: ${d.min} units</span></div><button class="btn btn-sm btn-p" onclick="A.placeOrderModal()">Reorder</button></div>`).join('')}</div></div></div>`:''}
    <div class="cr"><div class="card"><div class="ch"><h3>Sales Overview</h3></div><div class="cc"><canvas id="sc2"></canvas></div></div><div class="card"><div class="ch"><h3>Inventory by Category</h3></div><div class="cc"><canvas id="ic2"></canvas></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div class="card"><div class="ch"><h3>Recent Orders</h3><button class="btn btn-sm btn-s" onclick="A.nav('orders')">View All</button></div><div class="tw"><table><thead><tr><th>ID</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>${ords.slice(-5).reverse().map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}</td><td><span class="badge ${o.type==='inventory'?'b-acc':'b-info'}">${o.type}</span></td><td>₹${this.fmt(o.tot)}</td><td>${this.sbadge(o.status)}</td></tr>`).join('')}</tbody></table></div></div><div class="card"><div class="ch"><h3>Distributor Info</h3></div><div class="cb"><div class="ic"><div class="icg"><div class="if"><label>Company</label><span>${this.data.dist.name}</span></div><div class="if"><label>Phone</label><span>${this.data.dist.mobile}</span></div><div class="if"><label>Email</label><span>${this.data.dist.email}</span></div><div class="if"><label>Address</label><span>${this.data.dist.address}</span></div></div></div></div></div></div>`;
  },
  chartPh(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId);const ords=this.data.orders.filter(o=>o.phId===phId&&o.type==='customer');
    const c1=Q('#sc2')?.getContext('2d');if(c1)this.st.charts.s=new Chart(c1,{type:'bar',data:{labels:['Nov','Dec','Jan','Feb','Mar','Apr'],datasets:[{label:'Sales',data:[8200,12400,9800,14200,11600,Math.round(ords.reduce((s,o)=>s+o.tot,0))],backgroundColor:'rgba(108,99,255,.7)',borderColor:'#6C63FF',borderWidth:1,borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4'}},y:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4'}}}}});
    const c2=Q('#ic2')?.getContext('2d');if(c2){const cats={};drugs.forEach(d=>{cats[d.cat]=(cats[d.cat]||0)+d.qty;});this.st.charts.i=new Chart(c2,{type:'doughnut',data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats),backgroundColor:['#6C63FF','#00D4FF','#00D48E','#FFB547','#FF4757','#3B82F6'],borderColor:'#0E1826',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7B9CC4'}}},cutout:'60%'}});}
  },

  // ===== PHARMACY INVENTORY =====
  rInventory(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId);const today=new Date();const srch=this.st.filt.is||'';
    const filtered=drugs.filter(d=>!srch||d.name.toLowerCase().includes(srch.toLowerCase())||d.gen.toLowerCase().includes(srch.toLowerCase())||d.cat.toLowerCase().includes(srch.toLowerCase()));
    const ds=d=>{const e=new Date(d.exp);if(e<today)return'expired';if((e-today)/864e5<=30)return'expiring';if(d.qty<=d.min)return'low';return'ok';};
    return`<div class="ph"><div class="pt"><h1>Drug Inventory</h1><p>Manage all drugs in your pharmacy.</p></div><div class="pa"><button class="btn btn-s" onclick="A.exportCSV()" title="Export to CSV"><span class="material-icons-round">download</span>Export</button><button class="btn btn-s" onclick="A.openScanner()"><span class="material-icons-round">qr_code_scanner</span>Scan</button><button class="btn btn-p" onclick="A.addDrugModal()"><span class="material-icons-round">add</span>Add Drug</button></div></div>
    <div class="fb" style="justify-content:space-between"><div style="display:flex;gap:7px"><button class="fbtn active" onclick="A.fInv(this,'all')">All (${drugs.length})</button><button class="fbtn" onclick="A.fInv(this,'low')">Low Stock (${drugs.filter(d=>d.qty<=d.min).length})</button><button class="fbtn" onclick="A.fInv(this,'expiring')">Expiring (${drugs.filter(d=>{const e=new Date(d.exp);return e>today&&(e-today)/864e5<=30;}).length})</button><button class="fbtn" onclick="A.fInv(this,'expired')">Expired (${drugs.filter(d=>new Date(d.exp)<today).length})</button></div><div style="position:relative;max-width:240px"><span class="material-icons-round si-icon" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--mute);font-size:18px;pointer-events:none">search</span><input type="text" placeholder="Search drugs…" value="${srch}" oninput="A.setState('st.filt.is',this.value);A.nav('inventory')" style="padding-left:36px"></div></div>
    <div class="card"><div class="tw"><table id="invt"><thead><tr><th>Drug Name</th><th>Generic</th><th>Category</th><th>Quantity</th><th>Batch</th><th>MRP</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filtered.map(d=>{const s=ds(d);const days=Math.round((new Date(d.exp)-today)/864e5);return`<tr class="inv-${s==='expired'?'exp':s==='expiring'?'soon':s==='low'?'low':''}" data-ds="${s}"><td style="font-weight:700">${d.name}</td><td style="color:var(--mute)">${d.gen}</td><td><span class="badge b-gray">${d.cat}</span></td><td style="color:${d.qty<=d.min?'var(--err)':'var(--txt)'};font-weight:700">${d.qty}${d.qty<=d.min?' ⚠️':''}</td><td style="font-family:monospace;font-size:.8rem">${d.batch}</td><td>₹${d.mrp.toFixed(2)}</td><td style="color:${s==='expired'?'var(--err)':s==='expiring'?'var(--warn)':'var(--txt2)'}">${d.exp}${s==='expiring'?` (${days}d)`:s==='expired'?' ⚠️':''}</td><td>${s==='expired'?'<span class="badge b-err">Expired</span>':s==='expiring'?'<span class="badge b-warn">Expiring</span>':s==='low'?'<span class="badge b-err">Low Stock</span>':'<span class="badge b-ok">In Stock</span>'}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.editDrugModal('${d.id}')">Edit</button><button class="btn btn-sm btn-er" onclick="A.delDrug('${d.id}')">Delete</button></div></td></tr>`;}).join('')}${filtered.length===0?`<tr><td colspan="9"><div class="empty"><span class="material-icons-round">search_off</span><h3>No drugs found</h3></div></td></tr>`:''}</tbody></table></div></div>`;
  },
  fInv(btn,s){QA('.fbtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');QA('#invt tbody tr').forEach(r=>{r.style.display=(s==='all'||r.dataset.ds===s)?'':'none';});},
  addDrugModal(pre={}){
    const cats=['Analgesic','Antibiotic','Antidiabetic','Antihypertensive','Antihistamine','Statin','PPI','Antifungal','Antiviral','Vitamin','Other'];
    this.showModal('Add Drug',`<div class="fr"><div class="fg"><label>Drug Name *</label><input id="dn2" placeholder="e.g. Paracetamol 500mg" value="${pre.name||''}"></div><div class="fg"><label>Generic Name</label><input id="dg" placeholder="Generic name" value="${pre.gen||''}"></div></div><div class="fr"><div class="fg"><label>Category</label><select id="dc">${cats.map(c=>`<option value="${c}"${pre.cat===c?' selected':''}>${c}</option>`).join('')}</select></div><div class="fg"><label>Manufacturer</label><input id="dm" placeholder="e.g. Sun Pharma" value="${pre.mfr||''}"></div></div><div class="fr"><div class="fg"><label>Quantity *</label><input id="dq" type="number" min="0" placeholder="0" value="${pre.qty||''}"></div><div class="fg"><label>Min Stock</label><input id="dms" type="number" min="0" placeholder="50" value="${pre.min||50}"></div></div><div class="fr"><div class="fg"><label>Purchase Price ₹</label><input id="dp" type="number" min="0" step="0.01" placeholder="0.00" value="${pre.price||''}"></div><div class="fg"><label>MRP ₹</label><input id="dmp" type="number" min="0" step="0.01" placeholder="0.00" value="${pre.mrp||''}"></div></div><div class="fr"><div class="fg"><label>Batch No.</label><input id="db" placeholder="e.g. B2024001" value="${pre.batch||''}"></div><div class="fg"><label>Expiry Date *</label><input id="de" type="date" value="${pre.exp||''}"></div></div><div class="fg"><label>Barcode</label><input id="dbc" placeholder="Barcode number" value="${pre.bc||''}"></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.saveDrug()"><span class="material-icons-round">save</span>Add Drug</button>`);
  },
  async saveDrug(){
    const name=Q('#dn2')?.value.trim(),qty=parseInt(Q('#dq')?.value),exp=Q('#de')?.value;
    if(!name||!qty||!exp){this.toast('Fill required fields (*)','err');return;}
    const drug={phId:this.st.user.phId,name,gen:Q('#dg')?.value||'',cat:Q('#dc')?.value,mfr:Q('#dm')?.value||'',qty,min:parseInt(Q('#dms')?.value)||50,price:parseFloat(Q('#dp')?.value)||0,mrp:parseFloat(Q('#dmp')?.value)||0,batch:Q('#db')?.value||'AUTO'+Date.now(),exp,bc:Q('#dbc')?.value||''};const res=await apiPost('/drugs',drug);if(res?.ok){drug.id=res.id;this.data.drugs.push(drug);}this.closeModal();this.toast(name+' added!','ok');this.nav('inventory');
  },
  editDrugModal(id){
    const d=this.data.drugs.find(d=>d.id===id);if(!d)return;const cats=['Analgesic','Antibiotic','Antidiabetic','Antihypertensive','Antihistamine','Statin','PPI','Antifungal','Antiviral','Vitamin','Other'];
    this.showModal('Edit Drug – '+d.name,`<div class="fr"><div class="fg"><label>Name</label><input id="ed1" value="${d.name}"></div><div class="fg"><label>Category</label><select id="ed2">${cats.map(c=>`<option value="${c}"${d.cat===c?' selected':''}>${c}</option>`).join('')}</select></div></div><div class="fr"><div class="fg"><label>Quantity</label><input id="ed3" type="number" value="${d.qty}" min="0"></div><div class="fg"><label>Min Stock</label><input id="ed4" type="number" value="${d.min}" min="0"></div></div><div class="fr"><div class="fg"><label>Purchase ₹</label><input id="ed5" type="number" value="${d.price}" step="0.01"></div><div class="fg"><label>MRP ₹</label><input id="ed6" type="number" value="${d.mrp}" step="0.01"></div></div><div class="fr"><div class="fg"><label>Batch</label><input id="ed7" value="${d.batch}"></div><div class="fg"><label>Expiry</label><input id="ed8" type="date" value="${d.exp}"></div></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.updDrug('${id}')">Update</button>`);
  },
  updDrug(id){const d=this.data.drugs.find(d=>d.id===id);if(!d)return;d.name=Q('#ed1').value;d.cat=Q('#ed2').value;d.qty=parseInt(Q('#ed3').value);d.min=parseInt(Q('#ed4').value);d.price=parseFloat(Q('#ed5').value);d.mrp=parseFloat(Q('#ed6').value);d.batch=Q('#ed7').value;d.exp=Q('#ed8').value;this.save();this.closeModal();this.toast('Updated!','ok');this.nav('inventory');},
  delDrug(id){const d=this.data.drugs.find(d=>d.id===id);if(!confirm('Delete '+d?.name+'?'))return;this.data.drugs=this.data.drugs.filter(d=>d.id!==id);this.save();this.toast('Drug removed','warn');this.nav('inventory');},
  openScanner(){
    this.showModal('Barcode Scanner',`<p style="color:var(--txt2);text-align:center;margin-bottom:14px">Point camera at barcode or enter manually</p><div class="scan-wrap" id="sw"><video id="bvideo" autoplay muted playsinline></video><div class="scan-ovl"><div class="scan-frame"><div class="scan-line"></div></div></div></div><div style="text-align:center;margin:14px 0;color:var(--mute);font-size:.8rem">— or enter manually —</div><div style="display:flex;gap:7px"><input id="mbc" type="text" placeholder="Enter barcode number" style="flex:1"><button class="btn btn-p" onclick="A.lookupBC(Q('#mbc').value)">Lookup</button></div><div id="br" style="margin-top:10px"></div>`,
    `<button class="btn btn-s" onclick="A.stopScan();A.closeModal()">Close</button>`,'mdl-sm');
    this.startScan();
  },
  startScan(){
    const v=Q('#bvideo');if(!v)return;
    navigator.mediaDevices?.getUserMedia({video:{facingMode:'environment'}}).then(s=>{this._stream=s;v.srcObject=s;}).catch(()=>{const w=Q('#sw');if(w)w.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:160px;color:var(--mute)"><div style="text-align:center"><span class="material-icons-round" style="font-size:40px">no_photography</span><p style="margin-top:6px">Camera unavailable. Use manual entry.</p></div></div>';});
  },
  stopScan(){if(this._stream){this._stream.getTracks().forEach(t=>t.stop());this._stream=null;}},
  lookupBC(bc){const drug=this.data.drugs.find(d=>d.bc===bc);const el=Q('#br');if(drug){if(el)el.innerHTML=`<div class="ai info"><span class="material-icons-round ai-icon">check_circle</span><div class="ai-txt"><strong>${drug.name}</strong><span>Qty: ${drug.qty} · Exp: ${drug.exp}</span></div></div>`;}else{if(el)el.innerHTML=`<div class="ai warning"><span class="material-icons-round ai-icon">info</span><div class="ai-txt"><strong>Not found</strong><span>Barcode: ${bc}</span></div><button class="btn btn-sm btn-p" onclick="A.stopScan();A.closeModal();A.addDrugModal({bc:'${bc}'})">Add Drug</button></div>`;}},

  // ===== PHARMACY ORDERS =====
  rPhOrders(){
    const phId=this.st.user.phId;const all=this.data.orders.filter(o=>o.phId===phId);const t=this.st.filt.ot||'inventory';
    return`<div class="ph"><div class="pt"><h1>Orders</h1><p>Inventory and customer orders.</p></div><div class="pa"><button class="btn btn-p" onclick="A.placeOrderModal()"><span class="material-icons-round">add</span>Order from Distributor</button><button class="btn btn-s" onclick="A.custOrderModal()"><span class="material-icons-round">person</span>Sell to Customer</button></div></div>
    <div class="tabs"><button class="tab${t==='inventory'?' active':''}" onclick="A.setState('st.filt.ot','inventory');A.nav('orders')">Inventory Orders (${all.filter(o=>o.type==='inventory').length})</button><button class="tab${t==='customer'?' active':''}" onclick="A.setState('st.filt.ot','customer');A.nav('orders')">Customer Orders (${all.filter(o=>o.type==='customer').length})</button></div>
    ${t==='inventory'?this.rInvOrds(all.filter(o=>o.type==='inventory')):this.rCustOrds(all.filter(o=>o.type==='customer'))}`;
  },
  rInvOrds(ords){if(!ords.length)return`<div class="empty"><span class="material-icons-round">shopping_cart</span><h3>No inventory orders</h3><button class="btn btn-p" onclick="A.placeOrderModal()" style="margin-top:14px">Order Now</button></div>`;return`<div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Drugs</th><th>Date</th><th>Total</th><th>Delivery</th><th>Status</th><th>Actions</th></tr></thead><tbody>${ords.map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}</td><td>${o.drugs.map(d=>d.name+' ×'+d.qty).join(', ')}</td><td>${o.date}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(o.tot)}</td><td>${o.del==='free'?'<span class="badge b-ok">Free</span>':'<span class="badge b-gray">Paid</span>'}</td><td>${this.sbadge(o.status)}</td><td><button class="btn btn-sm btn-s" onclick="A.vOrder('${o.id}')">Details</button></td></tr>`).join('')}</tbody></table></div></div>`;},
  rCustOrds(ords){if(!ords.length)return`<div class="empty"><span class="material-icons-round">person</span><h3>No customer orders</h3></div>`;return`<div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Customer</th><th>Drugs</th><th>Date</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>${ords.map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}</td><td>${o.cust||'—'}</td><td>${o.drugs.map(d=>d.name).join(', ')}</td><td>${o.date}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(o.tot)}</td><td>${this.sbadge(o.status)}</td><td><button class="btn btn-sm btn-s" onclick="A.vOrder('${o.id}')">View</button></td></tr>`).join('')}</tbody></table></div></div>`;},

  placeOrderModal(){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);const del=ph?.plan==='1500'?'free':'paid';
    this.showModal('Order from Distributor',`<div class="ic" style="margin-bottom:14px"><div style="font-size:.875rem;color:var(--txt2)"><strong>Distributor:</strong> ${this.data.dist.name} &nbsp;|&nbsp; <strong>Plan:</strong> ${ph?.plan?`₹${ph.plan}/mo (${del==='free'?'Free':'Paid'} delivery)`:'No plan'}</div></div><div id="oi"><div class="fr" style="margin-bottom:7px"><div class="fg" style="margin-bottom:0"><label>Drug Name</label><input type="text" class="odn" placeholder="Drug name"></div><div class="fg" style="margin-bottom:0;max-width:90px"><label>Qty</label><input type="number" class="odq" min="1" placeholder="0"></div><div class="fg" style="margin-bottom:0;max-width:100px"><label>Price/unit ₹</label><input type="number" class="odp" min="0" step="0.01" placeholder="0.00"></div></div></div><button class="btn btn-s btn-sm" onclick="A.addOI()" style="margin-top:7px;margin-bottom:14px"><span class="material-icons-round">add</span>Add Drug</button><div class="fg"><label>Delivery</label><select id="od">${del==='free'?'<option value="free">Free Delivery (Your Plan)</option>':'<option value="paid">Paid Delivery</option><option value="free">Free Delivery (+₹300)</option>'}</select></div><div class="fg"><label>Notes</label><textarea id="on" placeholder="Special instructions…"></textarea></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.submitInvOrd()"><span class="material-icons-round">send</span>Place Order</button>`,'mdl-lg');
  },
  addOI(){const c=Q('#oi');const r=document.createElement('div');r.className='fr';r.style.marginBottom='7px';r.innerHTML='<div class="fg" style="margin-bottom:0"><input type="text" class="odn" placeholder="Drug name"></div><div class="fg" style="margin-bottom:0;max-width:90px"><input type="number" class="odq" min="1" placeholder="0"></div><div class="fg" style="margin-bottom:0;max-width:100px"><input type="number" class="odp" min="0" step="0.01" placeholder="0.00"></div>';c?.appendChild(r);},
  async submitInvOrd(){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);const names=QA('.odn'),qtys=QA('.odq'),prices=QA('.odp');const drugs=[];
    names.forEach((n,i)=>{if(n.value&&qtys[i]?.value){const q=parseInt(qtys[i].value),p=parseFloat(prices[i]?.value)||0;drugs.push({name:n.value,qty:q,up:p,tot:q*p});}});
    if(!drugs.length){this.toast('Add at least one drug','err');return;}
    const sub=drugs.reduce((s,d)=>s+d.tot,0),gst=sub*.05,tot=sub+gst;
    const ord={id:'ORD-'+Date.now(),type:'inventory',phId:ph.id,phName:ph.name,drugs,sub,gst,tot,date:new Date().toLocaleDateString('en-CA'),status:'pending',del:Q('#od')?.value||'paid',notes:Q('#on')?.value||'',billed:false};
    const res=await apiPost('/orders',ord);if(res?.ok){ord.id=res.id;this.data.orders.push(ord);this.addNotif('order','New order from '+ph.name+': '+ord.id,true);}this.closeModal();this.toast('Order placed!','ok',drugs.length+' items · ₹'+this.fmt(tot));this.nav('orders');
  },
  custOrderModal(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId&&d.qty>0);
    this.showModal('Sell to Customer',`<div class="fr"><div class="fg"><label>Customer Name</label><input id="cn" placeholder="Customer name"></div><div class="fg"><label>Phone</label><input id="cp" type="tel" placeholder="+91…"></div></div><div id="coi"><div class="fr" style="margin-bottom:7px"><div class="fg" style="margin-bottom:0"><label>Drug</label><select class="cds" onchange="A.upCp(this)"><option value="">Select drug</option>${drugs.map(d=>`<option value="${d.id}" data-p="${d.mrp}" data-max="${d.qty}">${d.name} (${d.qty} left)</option>`).join('')}</select></div><div class="fg" style="margin-bottom:0;max-width:80px"><label>Qty</label><input type="number" class="cq" min="1" value="1" placeholder="1"></div><div class="fg" style="margin-bottom:0;max-width:90px"><label>Price ₹</label><input type="number" class="cpr" min="0" step="0.01" placeholder="0.00"></div></div></div><button class="btn btn-s btn-sm" onclick="A.addCI()" style="margin-top:7px"><span class="material-icons-round">add</span>Add Drug</button>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-ok" onclick="A.submitCustOrd()"><span class="material-icons-round">sell</span>Process Sale</button>`,'mdl-lg');
  },
  upCp(sel){const o=sel.options[sel.selectedIndex];const r=sel.closest('.fr');if(r){const p=r.querySelector('.cpr');if(p&&o.dataset.p)p.value=o.dataset.p;}},
  addCI(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId&&d.qty>0);const c=Q('#coi');const r=document.createElement('div');r.className='fr';r.style.marginBottom='7px';
    r.innerHTML=`<div class="fg" style="margin-bottom:0"><select class="cds" onchange="A.upCp(this)"><option value="">Select</option>${drugs.map(d=>`<option value="${d.id}" data-p="${d.mrp}" data-max="${d.qty}">${d.name} (${d.qty} left)</option>`).join('')}</select></div><div class="fg" style="margin-bottom:0;max-width:80px"><input type="number" class="cq" min="1" value="1"></div><div class="fg" style="margin-bottom:0;max-width:90px"><input type="number" class="cpr" min="0" step="0.01"></div>`;c?.appendChild(r);
  },
  async submitCustOrd(){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);const items=[];
    QA('.cds').forEach((sel,i)=>{const qtys=QA('.cq'),prices=QA('.cpr');if(sel.value&&qtys[i]?.value){const drug=this.data.drugs.find(d=>d.id===sel.value);const qty=parseInt(qtys[i].value);const price=parseFloat(prices[i]?.value)||drug?.mrp||0;if(drug&&qty>0){if(qty>drug.qty){this.toast('Not enough stock for '+drug.name,'err');return;}items.push({drugId:sel.value,name:drug.name,qty,up:price,tot:qty*price});}}});
    if(!items.length){this.toast('Add at least one drug','err');return;}
    items.forEach(item=>{const drug=this.data.drugs.find(d=>d.id===item.drugId);if(drug)drug.qty-=item.qty;});
    const sub=items.reduce((s,i)=>s+i.tot,0),gst=sub*.05,tot=sub+gst;
    const ord={id:'ORD-'+Date.now(),type:'customer',phId:ph.id,phName:ph.name,cust:Q('#cn')?.value||'Walk-in',drugs:items.map(i=>({name:i.name,qty:i.qty,up:i.up,tot:i.tot})),sub,gst,tot,date:new Date().toLocaleDateString('en-CA'),status:'delivered',notes:''};
    this.data.orders.push(ord);this.save();this.closeModal();this.toast('Sale processed! Inventory updated.','ok','₹'+this.fmt(tot));this.nav('orders');
  },

  // ===== PHARMACY DOCS =====
  rPhDocs(){
    const phId=this.st.user.phId;const ph=this.data.pharmacies.find(p=>p.id===phId);const bills=this.data.bills.filter(b=>b.phId===phId);const dist=this.data.dist;
    return`<div class="ph"><div class="pt"><h1>Documentation</h1><p>Procurement bills and distributor info.</p></div><button class="btn btn-p" onclick="A.addDocModal('${phId}')"><span class="material-icons-round">upload_file</span>Upload Document</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px"><div class="card"><div class="ch"><h3>Distributor Contact</h3></div><div class="cb"><div class="ic"><div class="icg"><div class="if"><label>Company</label><span>${dist.name}</span></div><div class="if"><label>Phone</label><span><a href="tel:${dist.mobile}" style="color:var(--acc)">${dist.mobile}</a></span></div><div class="if"><label>Email</label><span><a href="mailto:${dist.email}" style="color:var(--acc)">${dist.email}</a></span></div><div class="if"><label>Address</label><span>${dist.address}</span></div><div class="if"><label>GST</label><span style="font-family:monospace">${dist.gst}</span></div><div class="if"><label>License</label><span style="font-family:monospace">${dist.license}</span></div></div></div></div></div>
    <div class="card"><div class="ch"><h3>Your Registration Info</h3></div><div class="cb"><div class="ic"><div class="icg"><div class="if"><label>Pharmacy Name</label><span>${ph?.name}</span></div><div class="if"><label>License</label><span style="font-family:monospace">${ph?.license}</span></div><div class="if"><label>Contact</label><span>${ph?.contact}</span></div><div class="if"><label>Email</label><span>${ph?.email}</span></div><div class="if" style="grid-column:1/-1"><label>Address</label><span>${ph?.address}</span></div></div></div></div></div></div>
    <div class="card"><div class="ch"><h3>Uploaded Documents</h3></div><div class="cb">${ph?.docs?.length>0?ph.docs.map(d=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:7px"><span class="material-icons-round" style="color:var(--err)">picture_as_pdf</span><span style="flex:1;font-size:.875rem;color:var(--txt)">${d.name}</span><span style="font-size:.72rem;color:var(--mute)">${d.size} · ${d.date}</span></div>`).join(''):'<p style="color:var(--mute)">No documents uploaded yet.</p>'}</div></div>
    <div class="card" style="margin-top:14px"><div class="ch"><h3>Procurement Bills from Distributor</h3></div><div class="tw"><table><thead><tr><th>Bill ID</th><th>Order</th><th>Amount</th><th>Date</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>${bills.map(b=>`<tr><td style="font-family:monospace;font-size:.8rem">${b.id}</td><td style="font-family:monospace;font-size:.8rem">${b.ordId}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(b.amt)}</td><td>${b.date}</td><td>${b.due}</td><td>${b.status==='paid'?'<span class="badge b-ok">Paid</span>':'<span class="badge b-err">Unpaid</span>'}</td><td>${b.status==='unpaid'?`<button class="btn btn-sm btn-ok" onclick="A.payBill('${b.id}')">Pay Now</button>`:''}</td></tr>`).join('')}${bills.length===0?'<tr><td colspan="7" style="text-align:center;color:var(--mute);padding:20px">No bills yet</td></tr>':''}</tbody></table></div></div>`;
  },

  // ===== PHARMACY BILLING =====
  rPhBilling(){
    const phId=this.st.user.phId;const bills=this.data.bills.filter(b=>b.phId===phId);const paid=bills.filter(b=>b.status==='paid');const unpaid=bills.filter(b=>b.status==='unpaid');
    return`<div class="ph"><div class="pt"><h1>Billing</h1><p>Your bills and payment history.</p></div></div>
    <div class="sg" style="grid-template-columns:repeat(3,1fr)"><div class="sc g"><div class="sic g"><span class="material-icons-round">check_circle</span></div><div><div class="sv">${paid.length}</div><div class="sl2">Bills Paid</div></div></div><div class="sc o"><div class="sic o"><span class="material-icons-round">pending_actions</span></div><div><div class="sv">${unpaid.length}</div><div class="sl2">Unpaid Bills</div><div class="scc dn">₹${this.fmt(unpaid.reduce((s,b)=>s+b.amt,0))} due</div></div></div><div class="sc p"><div class="sic p"><span class="material-icons-round">receipt_long</span></div><div><div class="sv">₹${this.fmt(paid.reduce((s,b)=>s+b.amt,0))}</div><div class="sl2">Total Paid</div></div></div></div>
    ${unpaid.length>0?`<div class="card" style="margin-bottom:14px;border-color:rgba(255,71,87,.3)"><div class="ch" style="border-color:rgba(255,71,87,.2)"><h3 style="color:var(--err)">⚠️ Unpaid Bills</h3><span class="badge b-err">₹${this.fmt(unpaid.reduce((s,b)=>s+b.amt,0))} due</span></div><div class="cb"><div class="al">${unpaid.map(b=>`<div class="ai danger"><span class="material-icons-round ai-icon">receipt_long</span><div class="ai-txt"><strong>${b.id} – ₹${this.fmt(b.amt)}</strong><span>Due: ${b.due}</span></div><button class="btn btn-sm btn-ok" onclick="A.payBill('${b.id}')">Pay Now</button></div>`).join('')}</div></div></div>`:''}
    <div class="card"><div class="ch"><h3>All Bills</h3></div><div class="tw"><table><thead><tr><th>Bill ID</th><th>Order</th><th>Amount</th><th>Date</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>${bills.map(b=>`<tr><td style="font-family:monospace;font-size:.8rem">${b.id}</td><td style="font-family:monospace;font-size:.8rem">${b.ordId}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(b.amt)}</td><td>${b.date}</td><td>${b.due}</td><td>${b.status==='paid'?'<span class="badge b-ok">Paid</span>':'<span class="badge b-err">Unpaid</span>'}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.vBill('${b.id}')">View</button>${b.status==='unpaid'?`<button class="btn btn-sm btn-ok" onclick="A.payBill('${b.id}')">Pay</button>`:''}</div></td></tr>`).join('')}${bills.length===0?'<tr><td colspan="7" style="text-align:center;color:var(--mute);padding:20px">No bills yet</td></tr>':''}</tbody></table></div></div>`;
  },
  payBill(id){
    this.showModal('Pay Bill',`<div class="ic" style="margin-bottom:14px">${(()=>{const b=this.data.bills.find(b=>b.id===id);return`<div class="icg"><div class="if"><label>Bill ID</label><span style="font-family:monospace">${b?.id}</span></div><div class="if"><label>Amount Due</label><span style="font-size:1.25rem;font-weight:800;color:var(--acc)">₹${this.fmt(b?.amt)}</span></div><div class="if"><label>Due Date</label><span>${b?.due}</span></div></div>`;})()}</div><div class="fg"><label>Payment Method</label><select id="pm"><option>UPI (GPay/PhonePe)</option><option>NEFT/RTGS</option><option>Cheque</option><option>Cash</option></select></div><div class="fg"><label>Transaction Reference</label><input id="ptr" placeholder="UTR/Reference number"></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-ok" onclick="A.confirmPay('${id}')"><span class="material-icons-round">payment</span>Confirm Payment</button>`);
  },
  async confirmPay(id){const b=this.data.bills.find(b=>b.id===id);if(!b)return;const paid=new Date().toLocaleDateString('en-CA');await apiPut('/bills/'+id,{status:'paid',paid});b.status='paid';b.paid=paid;this.closeModal();this.toast('Payment confirmed!','ok','Bill '+id+' marked as paid');this.nav('billing');},

  // ===== PHARMACY SUBSCRIPTIONS =====
  rPhSubs(){
    const phId=this.st.user.phId;const ph=this.data.pharmacies.find(p=>p.id===phId);
    return`<div class="ph"><div class="pt"><h1>Subscription</h1><p>Your current plan and billing.</p></div></div>
    ${ph?.plan?`<div class="card" style="margin-bottom:22px;border-color:var(--acc);background:linear-gradient(135deg,rgba(108,99,255,.1),var(--card))"><div class="cb" style="display:flex;align-items:center;gap:20px"><div style="flex:1"><div style="font-size:.8rem;color:var(--acc);font-weight:700;text-transform:uppercase;margin-bottom:4px">Active Plan</div><div style="font-size:2rem;font-weight:800;color:var(--txt)">₹${ph.plan}<span style="font-size:1rem;color:var(--mute)">/month</span></div><div style="color:var(--txt2);margin-top:4px">${ph.plan==='1500'?'Free delivery on all orders':'Paid delivery on orders'}</div><div style="font-size:.8rem;color:var(--mute);margin-top:4px">Expires: ${ph.planExpiry}</div>${ph.waived?'<div style="margin-top:8px"><span class="badge b-ok">Fee Waived by Admin</span></div>':''}</div><span class="material-icons-round" style="font-size:64px;color:var(--accL);color:rgba(108,99,255,.3)">verified</span></div></div>`:'<div class="card" style="margin-bottom:22px;border-color:var(--err)"><div class="cb" style="text-align:center;padding:32px"><span class="material-icons-round" style="font-size:48px;color:var(--mute)">card_membership</span><h3 style="margin-top:10px;color:var(--txt)">No Active Subscription</h3><p style="margin-top:4px">Choose a plan to start ordering</p></div></div>'}
    <div class="plans"><div class="plan"><div style="font-size:.8rem;font-weight:700;color:var(--mute);text-transform:uppercase;margin-bottom:7px">Basic</div><div class="pp"><sup>₹</sup>1000</div><div class="per">per month</div><ul class="pf"><li><span class="material-icons-round">check_circle</span>Unlimited Orders</li><li><span class="material-icons-round">check_circle</span>Paid Delivery</li><li><span class="material-icons-round">check_circle</span>Order Tracking</li><li><span class="material-icons-round">check_circle</span>Support Access</li></ul><button class="btn btn-s" style="width:100%;justify-content:center" onclick="A.subscribePlan('1000')">${ph?.plan==='1000'?'✓ Current Plan':'Choose Plan'}</button></div><div class="plan feat"><div style="font-size:.8rem;font-weight:700;color:var(--acc);text-transform:uppercase;margin-bottom:7px">Premium</div><div class="pp" style="color:var(--acc)"><sup>₹</sup>1500</div><div class="per">per month</div><ul class="pf"><li><span class="material-icons-round">check_circle</span>Unlimited Orders</li><li><span class="material-icons-round">check_circle</span>FREE Delivery</li><li><span class="material-icons-round">check_circle</span>Priority Processing</li><li><span class="material-icons-round">check_circle</span>Dedicated Support</li></ul><button class="btn btn-p" style="width:100%;justify-content:center" onclick="A.subscribePlan('1500')">${ph?.plan==='1500'?'✓ Current Plan':'Upgrade to Premium'}</button></div></div>`;
  },
  async subscribePlan(plan){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);if(!ph)return;if(ph.plan===plan){this.toast('Already on this plan','warn');return;}await apiPut('/pharmacies/'+ph.id,{...ph,plan,planExpiry:'2027-04-19'});ph.plan=plan;ph.planExpiry='2027-04-19';this.toast('Plan updated to ₹'+plan+'/mo!','ok');this.nav('subscriptions');
  },

  // ===== PHARMACY RETURNS =====
  rPhReturns(){
    const phId=this.st.user.phId;const rets=this.data.returns.filter(r=>r.phId===phId);
    return`<div class="ph"><div class="pt"><h1>Returns</h1><p>Request returns for expired, damaged, or wrong drugs.</p></div><button class="btn btn-p" onclick="A.returnModal()"><span class="material-icons-round">add</span>New Return</button></div>
    ${rets.length===0?'<div class="empty"><span class="material-icons-round">assignment_return</span><h3>No return requests yet</h3></div>':''}
    ${rets.map(r=>`<div class="card" style="margin-bottom:14px"><div class="ch"><div><span style="font-family:monospace;font-size:.875rem;color:var(--acc)">${r.id}</span></div><div style="display:flex;gap:7px;align-items:center"><span class="badge ${r.reason==='expired'?'b-err':r.reason==='damaged'?'b-warn':'b-info'}">${r.reason}</span>${this.sbadge(r.status)}</div></div><div class="cb"><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><div style="font-size:.72rem;color:var(--mute);margin-bottom:7px">DRUGS</div>${r.drugs.map(d=>`<div style="display:flex;justify-content:space-between;padding:7px;background:var(--inp);border-radius:var(--rs);margin-bottom:4px"><span style="color:var(--txt)">${d.name}</span><span style="color:var(--acc)">×${d.qty}</span></div>`).join('')}</div><div><div style="font-size:.72rem;color:var(--mute);margin-bottom:4px">Notes</div><p style="font-size:.875rem">${r.notes}</p>${r.anote?`<div style="margin-top:7px;padding:7px;background:var(--okL);border-radius:var(--rs);color:var(--ok);font-size:.8rem">📋 Admin: ${r.anote}</div>`:''}</div></div></div></div>`).join('')}`;
  },
  returnModal(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId);
    this.showModal('New Return Request',`<div class="fg"><label>Return Reason *</label><select id="rr"><option value="expired">Expired Drugs</option><option value="damaged">Damaged Drugs</option><option value="wrong">Wrong Drugs Delivered</option></select></div><div id="ri"><div class="fr" style="margin-bottom:7px"><div class="fg" style="margin-bottom:0"><label>Drug Name</label><input type="text" class="rdn" placeholder="Drug name"></div><div class="fg" style="margin-bottom:0;max-width:80px"><label>Qty</label><input type="number" class="rdq" min="1" placeholder="0"></div><div class="fg" style="margin-bottom:0;max-width:110px"><label>Batch No.</label><input type="text" class="rdb" placeholder="Batch"></div></div></div><button class="btn btn-s btn-sm" onclick="A.addRI()" style="margin-top:7px;margin-bottom:14px"><span class="material-icons-round">add</span>Add Drug</button><div class="fg"><label>Notes</label><textarea id="rn" placeholder="Describe the issue…"></textarea></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.submitReturn()"><span class="material-icons-round">send</span>Submit Return</button>`);
  },
  addRI(){const c=Q('#ri');const r=document.createElement('div');r.className='fr';r.style.marginBottom='7px';r.innerHTML='<div class="fg" style="margin-bottom:0"><input type="text" class="rdn" placeholder="Drug name"></div><div class="fg" style="margin-bottom:0;max-width:80px"><input type="number" class="rdq" min="1" placeholder="0"></div><div class="fg" style="margin-bottom:0;max-width:110px"><input type="text" class="rdb" placeholder="Batch"></div>';c?.appendChild(r);},
  async submitReturn(){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);const drugs=[];
    QA('.rdn').forEach((n,i)=>{const q=QA('.rdq')[i]?.value,b=QA('.rdb')[i]?.value;if(n.value&&q)drugs.push({name:n.value,qty:parseInt(q),batch:b||''});});
    if(!drugs.length){this.toast('Add at least one drug','err');return;}
    const ret={id:'RET-'+Date.now(),phId:ph.id,phName:ph.name,reason:Q('#rr').value,drugs,date:new Date().toLocaleDateString('en-CA'),status:'pending',notes:Q('#rn')?.value||'',anote:''};
    const res=await apiPost('/returns',ret);if(res?.ok){ret.id=res.id;this.data.returns.push(ret);this.addNotif('return','Return request from '+ph.name,true);}this.closeModal();this.toast('Return request submitted!','ok');this.nav('returns');
  },

  // ===== PHARMACY SUPPORT =====
  rPhSupport(){
    const dist=this.data.dist;
    return`<div class="ph"><div class="pt"><h1>Support</h1><p>Get help from the distributor team.</p></div></div>
    <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:22px"><div class="card cb" style="text-align:center;border-color:var(--info)"><span class="material-icons-round" style="font-size:34px;color:var(--info)">phone</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">${dist.mobile}</div><div style="color:var(--mute);font-size:.8rem">Call Support</div><a href="tel:${dist.mobile}" class="btn btn-p" style="margin-top:10px;display:inline-flex">Call Now</a></div><div class="card cb" style="text-align:center;border-color:var(--ok)"><span class="material-icons-round" style="font-size:34px;color:var(--ok)">email</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">${dist.email}</div><div style="color:var(--mute);font-size:.8rem">Email Support</div><a href="mailto:${dist.email}" class="btn btn-ok" style="margin-top:10px;display:inline-flex">Send Email</a></div><div class="card cb" style="text-align:center;border-color:var(--acc)"><span class="material-icons-round" style="font-size:34px;color:var(--acc)">chat</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">Live Chat</div><div style="color:var(--mute);font-size:.8rem">Chat with Support</div><button class="btn btn-p" style="margin-top:10px" onclick="A.chatModal(true)">Start Chat</button></div></div>
    <div class="card"><div class="ch"><h3>Submit a Support Ticket</h3></div><div class="cb"><div class="fr"><div class="fg"><label>Subject</label><input id="ts" placeholder="Brief description of issue"></div><div class="fg"><label>Type</label><select id="tt"><option value="billing">Billing</option><option value="order">Order</option><option value="delivery">Delivery</option><option value="technical">Technical</option><option value="other">Other</option></select></div></div><div class="fg"><label>Description</label><textarea id="td" placeholder="Describe your issue in detail…" style="min-height:100px"></textarea></div><button class="btn btn-p" onclick="A.submitTicket()"><span class="material-icons-round">send</span>Submit Ticket</button></div></div>`;
  },
  async submitTicket(){
    const sub=Q('#ts')?.value.trim();if(!sub){this.toast('Enter subject','err');return;}const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);
    const tk={phId:ph.id,phName:ph.name,subject:sub,type:Q('#tt')?.value||'other',date:new Date().toLocaleDateString('en-IN'),status:'open',msgs:[{from:'pharmacy',text:Q('#td')?.value||sub,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}]};const res=await apiPost('/tickets',tk);if(res?.ok){tk.id=res.id;this.data.tickets.push(tk);}this.toast('Ticket submitted! We\'ll respond shortly.','ok');this.nav('support');
  },
};

// Helpers
function Q(sel){return document.querySelector(sel);}
function QA(sel){return document.querySelectorAll(sel);}

// Keyboard shortcuts
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){A.closeModal();const np=Q('#np');if(np?.classList.contains('open'))np.classList.remove('open');}
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();Q('#global-search')?.focus();}
});

// Export CSV
A.exportCSV=function(){
  const phId=this.st.user?.phId;if(!phId)return;
  const drugs=this.data.drugs.filter(d=>d.phId===phId);
  const rows=[['Drug Name','Generic','Category','Manufacturer','Batch','Quantity','Min Stock','Purchase Price','MRP','Expiry','Barcode']];
  drugs.forEach(d=>rows.push([d.name,d.gen,d.cat,d.mfr,d.batch,d.qty,d.min,d.price,d.mrp,d.exp,d.bc]));
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='inventory_'+new Date().toLocaleDateString('en-CA')+'.csv';a.click();
  this.toast('Inventory exported as CSV!','ok');
};

// Print Bill
A.printBill=function(id){
  const b=this.data.bills.find(b=>b.id===id);if(!b)return;
  const d=this.data.dist;
  const w=window.open('','_blank','width=800,height=700');
  if(!w)return;
  w.document.write(`<!DOCTYPE html><html><head><title>Bill ${b.id}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:720px;margin:0 auto}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #6C63FF}
  .co-name{font-size:22px;font-weight:800;color:#6C63FF;margin-bottom:4px}.co-info{font-size:13px;color:#555}
  .bill-title{font-size:22px;font-weight:800;text-align:right}.bill-id{color:#777;font-size:14px;margin-top:4px}
  .status{display:inline-block;padding:4px 14px;border-radius:99px;font-size:13px;font-weight:700;margin-top:8px;background:${b.status==='paid'?'#00D48E':'#FF4757'};color:#fff}
  .section{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:18px}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0}
  .row:last-child{border-bottom:none}.lbl{color:#777;font-size:13px}.val{font-weight:600;font-size:14px}
  .total{text-align:right;font-size:26px;font-weight:800;color:#6C63FF;margin-top:20px;padding-top:16px;border-top:2px solid #6C63FF}
  .footer{margin-top:30px;text-align:center;color:#999;font-size:12px}
  .btn{padding:10px 24px;background:#6C63FF;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;margin-top:20px}
  @media print{.no-print{display:none}}</style>
  </head><body>
  <div class="hdr"><div><div class="co-name">${d.name}</div><div class="co-info">${d.address}<br>GST: ${d.gst} | License: ${d.license}</div></div>
  <div><div class="bill-title">TAX INVOICE</div><div class="bill-id">${b.id}</div><div><span class="status">${b.status.toUpperCase()}</span></div></div></div>
  <div class="section">
  <div class="row"><span class="lbl">Billed To</span><span class="val">${b.phName}</span></div>
  <div class="row"><span class="lbl">Invoice Date</span><span class="val">${b.date}</span></div>
  <div class="row"><span class="lbl">Due Date</span><span class="val">${b.due}</span></div>
  ${b.paid?`<div class="row"><span class="lbl" style="color:#00D48E">Paid On</span><span class="val" style="color:#00D48E">${b.paid}</span></div>`:''}
  <div class="row"><span class="lbl">Order Reference</span><span class="val">${b.ordId}</span></div>
  <div class="row"><span class="lbl">Bill Type</span><span class="val">${b.type.toUpperCase()}</span></div>
  </div>
  <div class="total">Total: ₹${(+b.amt).toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
  <div class="footer">PharmaDist Pro • Automated Billing System<br>${d.email} • ${d.phone}</div>
  <div class="no-print" style="text-align:center"><button class="btn" onclick="window.print()">🖨️ Print / Save PDF</button></div>
  </body></html>`);w.document.close();
};

// Start
A.init();
async function loadData() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*");

  if (error) {
    console.log("Error:", error);
    return;
  }

  const list = document.getElementById("product-list");
  list.innerHTML = "";

  data.forEach(item => {
    const li = document.createElement("li");
  li.innerHTML = `
  ${item.name} - ₹${item.price}
  <button onclick="editProduct(${item.id}, \`${item.name}\`, ${item.price})">✏️</button>
  <button onclick="deleteProduct(${item.id})">❌</button>
`;
    list.appendChild(li);
  });
}

loadData();
async function addProduct() {
  const { data, error } = await supabaseClient
    .from("products")
    .insert([
      { name: "Dolo 650", price: 30 }
    ]);

  if (error) {
    console.log("Insert Error:", error);
  } else {
    console.log("Inserted:", data);
    loadData(); // 🔥 refresh list
  }
async function addCustomProduct() {
  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;

  if (!name || !price) {
    alert("Enter all fields");
    return;
  }

  const { data, error } = await supabaseClient
    .from("products")
    .insert([
      { name: name, price: parseInt(price) }
    ]);

  if (error) {
    console.log("Error:", error);
  } else {
    console.log("Added:", data);
    loadData();

    document.getElementById("name").value = "";
    document.getElementById("price").value = "";
  }
}
async function editProduct(id, oldName, oldPrice) {
  const newName = prompt("Enter new name:", oldName);
  const newPrice = prompt("Enter new price:", oldPrice);

  if (!newName || !newPrice) return;

  const { error } = await supabaseClient
    .from("products")
    .update({
      name: newName,
      price: parseInt(newPrice)
    })
    .eq("id", id);

  if (error) {
    console.log("Update Error:", error);
  } else {
    loadData(); // refresh list
  }
}
