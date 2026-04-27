// ==================== ХРАНИЛИЩЕ ====================
class Storage {
    constructor() {
        this.dbName = 'SalonCRM';
        this.db = null;
    }
    async init() {
        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbName, 2);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('clients')) {
                    const clientStore = db.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
                    clientStore.createIndex('phone', 'phone');
                }
                if (!db.objectStoreNames.contains('services')) {
                    db.createObjectStore('services', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('visits')) {
                    db.createObjectStore('visits', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('visitServices')) {
                    db.createObjectStore('visitServices', { keyPath: 'id', autoIncrement: true });
                }
                // Начальные данные
                if (!db.objectStoreNames.contains('services')) return;
                const tx = e.target.transaction;
                const serviceStore = tx.objectStore('services');
                serviceStore.count().onsuccess = (ev) => {
                    if (ev.target.result === 0) {
                        serviceStore.add({ name: 'Стрижка', price: 1500, duration: 60 });
                        serviceStore.add({ name: 'Окрашивание', price: 3500, duration: 120 });
                        serviceStore.add({ name: 'Маникюр', price: 1200, duration: 60 });
                        serviceStore.add({ name: 'Педикюр', price: 1800, duration: 90 });
                    }
                };
            };
            request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
        });
    }
    async getAll(store) { return new Promise((resolve) => { const tx = this.db.transaction(store, 'readonly'); resolve(tx.objectStore(store).getAll().onsuccess = (e) => resolve(e.target.result)); }); }
    async add(store, data) { return new Promise((resolve) => { const tx = this.db.transaction(store, 'readwrite'); resolve(tx.objectStore(store).add(data).onsuccess = (e) => resolve(e.target.result)); }); }
    async update(store, data) { return new Promise((resolve) => { const tx = this.db.transaction(store, 'readwrite'); tx.objectStore(store).put(data).onsuccess = () => resolve(); }); }
    async delete(store, id) { return new Promise((resolve) => { const tx = this.db.transaction(store, 'readwrite'); tx.objectStore(store).delete(id).onsuccess = () => resolve(); }); }
}

// ==================== ПРИЛОЖЕНИЕ ====================
let app;
class SalonApp {
    constructor() { this.storage = new Storage(); this.currentUser = null; }
    
    async init() {
        await this.storage.init();
        await this.loadData();
        this.bindEvents();
        this.renderServices();
        this.renderClients();
        this.renderVisits();
    }
    
    async loadData() {
        this.clients = await this.storage.getAll('clients') || [];
        this.services = await this.storage.getAll('services') || [];
        this.visits = await this.storage.getAll('visits') || [];
        this.visitServices = await this.storage.getAll('visitServices') || [];
    }
    
    async refresh() { await this.loadData(); this.renderClients(); this.renderVisits(); this.renderServices(); if (this.currentUser === 'owner') this.renderFinance(); }
    
    bindEvents() {
        document.getElementById('loginBtn').onclick = () => this.login();
        document.getElementById('logoutBtn').onclick = () => this.logout();
        document.getElementById('addClientBtn').onclick = () => this.openClientModal();
        document.getElementById('addVisitBtn').onclick = () => this.openVisitModal();
        document.getElementById('addServiceBtn').onclick = () => this.openServiceModal();
        document.getElementById('addServiceBtnFooter').onclick = () => this.openServiceModal();
        document.getElementById('reportBtn').onclick = () => this.openReportModal();
        document.getElementById('refreshBtn').onclick = () => this.refresh();
        document.getElementById('searchInput').oninput = () => this.renderClients();
        document.getElementById('clearSearchBtn').onclick = () => { document.getElementById('searchInput').value = ''; this.renderClients(); };
        document.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => { this.switchTab(btn.dataset.tab); });
        document.getElementById('saveClientBtn').onclick = () => this.saveClient();
        document.getElementById('saveServiceBtn').onclick = () => this.saveService();
        document.getElementById('saveVisitBtn').onclick = () => this.saveVisit();
        ['clientModal', 'serviceModal', 'visitModal', 'reportModal'].forEach(id => {
            const modal = document.getElementById(id);
            modal.querySelector('.close').onclick = () => modal.style.display = 'none';
            window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        });
        document.getElementById('cancelClientBtn').onclick = () => document.getElementById('clientModal').style.display = 'none';
        document.getElementById('cancelServiceBtn').onclick = () => document.getElementById('serviceModal').style.display = 'none';
        document.getElementById('cancelVisitBtn').onclick = () => document.getElementById('visitModal').style.display = 'none';
        document.getElementById('closeReportBtn').onclick = () => document.getElementById('reportModal').style.display = 'none';
    }
    
    login() {
        const role = document.getElementById('roleSelect').value;
        const pass = document.getElementById('passwordInput').value;
        if (pass === '123') {
            this.currentUser = role;
            document.getElementById('authPanel').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            document.getElementById('userRoleDisplay').innerHTML = role === 'admin' ? '👑 Администратор' : (role === 'master' ? '✂️ Мастер' : '📊 Владелец');
            // Скрыть кнопки в зависимости от роли
            const isOwner = role === 'owner';
            const isAdmin = role === 'admin';
            document.querySelectorAll('#addClientBtn, #addVisitBtn, #addServiceBtn').forEach(btn => btn.style.display = (isAdmin || role === 'master') ? 'inline-flex' : 'none');
            document.querySelector('.owner-tab').style.display = isOwner ? 'inline-block' : 'none';
            if (isOwner) this.renderFinance();
            this.updateStatus(`✅ Вход выполнен как ${role === 'admin' ? 'Администратор' : (role === 'master' ? 'Мастер' : 'Владелец')}`);
        } else { alert('Неверный пароль'); }
    }
    
    logout() { this.currentUser = null; document.getElementById('authPanel').style.display = 'flex'; document.getElementById('mainApp').style.display = 'none'; }
    
    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}Tab`).classList.add('active');
        if (tab === 'finance') this.renderFinance();
    }
    
    updateStatus(msg, isError = false) { document.getElementById('statusMessage').innerHTML = (isError ? '❌ ' : '✅ ') + msg; setTimeout(() => { if(document.getElementById('statusMessage').innerHTML.includes(msg)) this.updateStatus('Готово'); }, 3000); }
    
    escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, function(m) { if(m === '&') return '&amp;'; if(m === '<') return '&lt;'; if(m === '>') return '&gt;'; return m;}); }
    
    // === КЛИЕНТЫ ===
    openClientModal(client = null) { this.editClient = client; document.getElementById('clientModalTitle').innerText = client ? '✏️ Редактировать клиента' : '➕ Добавить клиента'; document.getElementById('clientFullName').value = client?.fullName || ''; document.getElementById('clientPhone').value = client?.phone || ''; document.getElementById('clientEmail').value = client?.email || ''; document.getElementById('clientDiscount').value = client?.discount || 0; document.getElementById('clientModal').style.display = 'flex'; }
    async saveClient() {
        const data = { fullName: document.getElementById('clientFullName').value.trim(), phone: document.getElementById('clientPhone').value.trim(), email: document.getElementById('clientEmail').value.trim(), discount: parseInt(document.getElementById('clientDiscount').value) || 0, firstVisit: this.editClient?.firstVisit || new Date().toISOString().split('T')[0] };
        if(!data.fullName || !data.phone) { this.updateStatus('Заполните ФИО и телефон', true); return; }
        if(this.editClient) { data.id = this.editClient.id; await this.storage.update('clients', data); this.updateStatus('Клиент обновлён'); }
        else { await this.storage.add('clients', data); this.updateStatus('Клиент добавлен'); }
        document.getElementById('clientModal').style.display = 'none'; this.editClient = null; await this.refresh();
    }
    async deleteClient(id) { if(confirm('Удалить клиента? Все его визиты также будут удалены.')) { await this.storage.delete('clients', id); this.updateStatus('Клиент удалён'); await this.refresh(); } }
    renderClients() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        let filtered = this.clients.filter(c => c.fullName?.toLowerCase().includes(search) || c.phone?.includes(search));
        const tbody = document.getElementById('clientsTableBody');
        if(filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Нет клиентов</td></tr>'; return; }
        tbody.innerHTML = filtered.map(c => `<tr><td>${c.id}</td><td><strong>${this.escapeHtml(c.fullName)}</strong></td><td>${this.escapeHtml(c.phone)}</td><td>${c.email || '—'}</td><td>${c.firstVisit || '—'}</td><td>${c.discount || 0}%</td><td class="action-buttons"><button class="btn btn-sm edit-btn" onclick="app.deleteClient(${c.id})">🗑️</button></td></tr>`).join('');
    }
    
    // === УСЛУГИ ===
    openServiceModal(service = null) { this.editService = service; document.getElementById('serviceModalTitle').innerText = service ? '✏️ Редактировать услугу' : '➕ Добавить услугу'; document.getElementById('serviceName').value = service?.name || ''; document.getElementById('servicePrice').value = service?.price || ''; document.getElementById('serviceDuration').value = service?.duration || 60; document.getElementById('serviceModal').style.display = 'flex'; }
    async saveService() {
        const data = { name: document.getElementById('serviceName').value.trim(), price: parseFloat(document.getElementById('servicePrice').value), duration: parseInt(document.getElementById('serviceDuration').value) || 0 };
        if(!data.name || isNaN(data.price)) { this.updateStatus('Заполните название и цену', true); return; }
        if(this.editService) { data.id = this.editService.id; await this.storage.update('services', data); this.updateStatus('Услуга обновлена'); }
        else { await this.storage.add('services', data); this.updateStatus('Услуга добавлена'); }
        document.getElementById('serviceModal').style.display = 'none'; this.editService = null; await this.refresh();
    }
    async deleteService(id) { if(confirm('Удалить услугу?')) { await this.storage.delete('services', id); this.updateStatus('Услуга удалена'); await this.refresh(); } }
    renderServices() {
        const tbody = document.getElementById('servicesTableBody');
        if(this.services.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Нет услуг</td></tr>'; return; }
        tbody.innerHTML = this.services.map(s => `<tr><td>${s.id}</td><td>${this.escapeHtml(s.name)}</td><td>${s.price.toLocaleString()} ₽</td><td>${s.duration || 60} мин</td><td class="action-buttons"><button class="btn btn-sm delete-btn" onclick="app.deleteService(${s.id})">🗑️</button></td></tr>`).join('');
    }
    
    // === ВИЗИТЫ ===
    async openVisitModal() {
        const clientSelect = document.getElementById('visitClientId');
        clientSelect.innerHTML = '<option value="">-- Выберите клиента --</option>' + this.clients.map(c => `<option value="${c.id}">${this.escapeHtml(c.fullName)} (${c.phone})</option>`).join('');
        const checklist = document.getElementById('servicesChecklist');
        checklist.innerHTML = this.services.map(s => `<div class="service-checkbox"><label><input type="checkbox" data-service-id="${s.id}" data-price="${s.price}"> ${this.escapeHtml(s.name)}</label><span>${s.price.toLocaleString()} ₽</span></div>`).join('');
        checklist.querySelectorAll('input').forEach(cb => cb.onchange = () => this.calcVisitTotal());
        document.getElementById('visitDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('visitModal').style.display = 'flex';
        this.calcVisitTotal();
    }
    calcVisitTotal() { let total = 0; document.querySelectorAll('#servicesChecklist input:checked').forEach(cb => total += parseFloat(cb.dataset.price)); document.getElementById('visitTotalAmount').innerHTML = total.toLocaleString() + ' ₽'; }
    async saveVisit() {
        const clientId = parseInt(document.getElementById('visitClientId').value);
        const date = document.getElementById('visitDate').value;
        const paymentStatus = document.getElementById('visitPaymentStatus').value;
        const selectedServices = Array.from(document.querySelectorAll('#servicesChecklist input:checked')).map(cb => ({ serviceId: parseInt(cb.dataset.serviceId), price: parseFloat(cb.dataset.price) }));
        if(!clientId || selectedServices.length === 0) { this.updateStatus('Выберите клиента и хотя бы одну услугу', true); return; }
        const total = selectedServices.reduce((s, item) => s + item.price, 0);
        const visit = { clientId, date, total, paymentStatus };
        const visitId = await this.storage.add('visits', visit);
        for(let item of selectedServices) { await this.storage.add('visitServices', { visitId, serviceId: item.serviceId, price: item.price }); }
        document.getElementById('visitModal').style.display = 'none';
        await this.refresh();
        this.updateStatus('Визит добавлен');
    }
    async deleteVisit(id) { if(confirm('Удалить визит?')) { await this.storage.delete('visits', id); await this.refresh(); this.updateStatus('Визит удалён'); } }
    async renderVisits() {
        const visitsWithData = [];
        for(let visit of this.visits) {
            const client = this.clients.find(c => c.id === visit.clientId);
            const servicesList = (this.visitServices || []).filter(vs => vs.visitId === visit.id);
            const serviceNames = servicesList.map(vs => { const s = this.services.find(srv => srv.id === vs.serviceId); return s ? s.name : '—'; });
            visitsWithData.push({ ...visit, clientName: client?.fullName || 'Неизвестен', services: serviceNames.join(', ') });
        }
        const tbody = document.getElementById('visitsTableBody');
        if(visitsWithData.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Нет визитов</td></tr>'; return; }
        tbody.innerHTML = visitsWithData.map(v => `<tr><td>${v.id}</td><td><strong>${this.escapeHtml(v.clientName)}</strong></td><td>${v.date}</td><td>${this.escapeHtml(v.services) || '—'}</td><td>${v.total?.toLocaleString()} ₽</td><td>${v.paymentStatus || 'Оплачено'}</td><td class="action-buttons"><button class="btn btn-sm delete-btn" onclick="app.deleteVisit(${v.id})">🗑️</button></td></tr>`).join('');
    }
    
    // === ОТЧЁТЫ ===
    openReportModal() {
        const report = [];
        for(let client of this.clients) {
            const clientVisits = this.visits.filter(v => v.clientId === client.id);
            const count = clientVisits.length;
            const total = clientVisits.reduce((s, v) => s + (v.total || 0), 0);
            if(count > 0) report.push({ clientName: client.fullName, count, total, avg: total / count });
        }
        report.sort((a,b) => b.count - a.count);
        const tbody = document.getElementById('reportTableBody');
        if(report.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Нет данных</td></tr>'; }
        else { tbody.innerHTML = report.map(r => `<tr><td><strong>${this.escapeHtml(r.clientName)}</strong></td><td>${r.count}</td><td>${r.total.toLocaleString()} ₽</td><td>${Math.round(r.avg).toLocaleString()} ₽</td></tr>`).join(''); }
        document.getElementById('reportModal').style.display = 'flex';
    }
    
    // === ФИНАНСЫ (владелец) ===
    renderFinance() {
        const totalRevenue = this.visits.reduce((s, v) => s + (v.total || 0), 0);
        const totalVisits = this.visits.length;
        const avgCheck = totalVisits > 0 ? totalRevenue / totalVisits : 0;
        document.getElementById('financeStats').innerHTML = `<div class="stat-card"><h4>📊 Общая выручка</h4><div class="value">${totalRevenue.toLocaleString()} ₽</div></div>
            <div class="stat-card"><h4>📅 Всего визитов</h4><div class="value">${totalVisits}</div></div>
            <div class="stat-card"><h4>💰 Средний чек</h4><div class="value">${Math.round(avgCheck).toLocaleString()} ₽</div></div>`;
        const tbody = document.getElementById('financeTableBody');
        tbody.innerHTML = `<tr><td>Все время</td><td>${totalRevenue.toLocaleString()} ₽</td><td>${totalVisits}</td><td>${Math.round(avgCheck).toLocaleString()} ₽</td></tr>`;
    }
}

window.onload = async () => { app = new SalonApp(); await app.init(); };
