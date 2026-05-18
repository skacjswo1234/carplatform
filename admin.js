// API 기본 URL (실제 배포 후 변경 필요)
const API_BASE_URL = '/api';

// 전역 상태
let currentPage = 1;
let itemsPerPage = 10;
let allInquiries = [];
let filteredInquiries = [];

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 로그인 상태 확인
    checkLoginStatus();
    
    initEventListeners();
    prefetchBlockedIps();
    loadInquiries();
});

async function prefetchBlockedIps() {
    try {
        const response = await fetch(`${API_BASE_URL}/blocked-ips`);
        const data = await response.json();
        if (response.ok && data.success) {
            ipBlockData.blocked = data.blocked || [];
        }
    } catch (_) {}
}

// 로그인 상태 확인
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('admin_logged_in') === 'true';
    
    if (!isLoggedIn) {
        // 로그인되지 않았으면 로그인 페이지로 리다이렉트
        window.location.href = 'login.html';
        return;
    }
}

// 로그아웃 함수 (필요시 사용)
function logout() {
    localStorage.removeItem('admin_logged_in');
    window.location.href = 'login.html';
}

// 이벤트 리스너 초기화
function initEventListeners() {
    // 모바일 메뉴
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');

    mobileMenuBtn.addEventListener('click', function() {
        sidebar.classList.toggle('active');
        mobileOverlay.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active');
    });

    mobileOverlay.addEventListener('click', function() {
        sidebar.classList.remove('active');
        mobileOverlay.classList.remove('active');
        mobileMenuBtn.classList.remove('active');
    });

    // 네비게이션 메뉴
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            switchPage(page);
            
            // 모바일에서 메뉴 닫기
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                mobileOverlay.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
            }
        });
    });

    // 새로고침 버튼
    document.getElementById('refreshBtn').addEventListener('click', function() {
        const activeNav = document.querySelector('.nav-item.active');
        const page = activeNav && activeNav.dataset.page ? activeNav.dataset.page : 'inquiries';
        if (page === 'ipblock') loadIpBlockData();
        else if (page === 'reviews') loadReviews();
        else loadInquiries();
    });

    // 검색 및 필터
    document.getElementById('searchInput').addEventListener('input', function() {
        filterInquiries();
    });

    document.getElementById('filterStatus').addEventListener('change', function() {
        filterInquiries();
    });

    initIpBlockListDelegation();

    // 모달 닫기
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    
    const modal = document.getElementById('detailModal');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // 알림 모달
    const messageModal = document.getElementById('messageModal');
    const messageModalBtn = document.getElementById('messageModalBtn');
    if (messageModalBtn) {
        messageModalBtn.addEventListener('click', function() {
            messageModal.classList.remove('active');
        });
    }
    if (messageModal) {
        messageModal.addEventListener('click', function(e) {
            if (e.target === messageModal) messageModal.classList.remove('active');
        });
    }

    // 확인 모달
    const confirmModal = document.getElementById('confirmModal');
    const confirmModalCancel = document.getElementById('confirmModalCancel');
    const confirmModalConfirm = document.getElementById('confirmModalConfirm');
    if (confirmModalCancel) {
        confirmModalCancel.addEventListener('click', function() {
            confirmModal.classList.remove('active');
        });
    }
    if (confirmModalConfirm) {
        confirmModalConfirm.addEventListener('click', function() {
            if (typeof _confirmModalOnConfirm === 'function') _confirmModalOnConfirm();
            _confirmModalOnConfirm = null;
            confirmModal.classList.remove('active');
        });
    }
    if (confirmModal) {
        confirmModal.addEventListener('click', function(e) {
            if (e.target === confirmModal) confirmModal.classList.remove('active');
        });
    }

    // 고객후기 관리 이벤트
    const addReviewBtn = document.getElementById('addReviewBtn');
    if (addReviewBtn) {
        addReviewBtn.addEventListener('click', function() {
            openReviewModal();
        });
    }

    const saveReviewBtn = document.getElementById('saveReviewBtn');
    if (saveReviewBtn) {
        saveReviewBtn.addEventListener('click', function() {
            saveReview();
        });
    }

    const cancelReviewBtn = document.getElementById('cancelReviewBtn');
    if (cancelReviewBtn) {
        cancelReviewBtn.addEventListener('click', function() {
            closeReviewModal();
        });
    }

    const closeReviewModalBtn = document.getElementById('closeReviewModal');
    if (closeReviewModalBtn) {
        closeReviewModalBtn.addEventListener('click', function() {
            closeReviewModal();
        });
    }

    const reviewModal = document.getElementById('reviewModal');
    if (reviewModal) {
        reviewModal.addEventListener('click', function(e) {
            if (e.target === reviewModal) {
                closeReviewModal();
            }
        });
    }

    var reviewImagesInput = document.getElementById('reviewImages');
    var fileUploadArea = document.getElementById('fileUploadArea');
    if (reviewImagesInput) {
        reviewImagesInput.addEventListener('change', function(e) {
            previewReviewImages(e.target.files);
        });
    }
    if (fileUploadArea && reviewImagesInput) {
        fileUploadArea.addEventListener('click', function() {
            reviewImagesInput.click();
        });
        fileUploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fileUploadArea.classList.add('drag-over');
        });
        fileUploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fileUploadArea.classList.remove('drag-over');
        });
        fileUploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fileUploadArea.classList.remove('drag-over');
            var files = e.dataTransfer && e.dataTransfer.files;
            if (!files || files.length === 0) return;
            addReviewFiles(Array.prototype.slice.call(files));
        });
    }
}

// 페이지 전환
function switchPage(page) {
    // 네비게이션 활성화
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });

    // 페이지 컨텐츠 전환
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.remove('active');
    });

    const pageElement = document.getElementById(page + 'Page');
    if (pageElement) {
        pageElement.classList.add('active');
    }

    // 페이지 제목 업데이트
    const titles = {
        'inquiries': '문의 리스트',
        'ipblock': 'IP 차단 관리',
        'reviews': '고객후기 관리',
        'password': '비밀번호 변경'
    };
    document.getElementById('pageTitle').textContent = titles[page] || '';

    // 페이지별 초기화
    if (page === 'reviews') {
        loadReviews();
    } else if (page === 'ipblock') {
        loadIpBlockData();
    }
}

let ipBlockData = { blocked: [], inquiry_records: [], inquiry_ips: [] };
let ipBlockPage = 1;
const IPBLOCK_PER_PAGE = 10;

function getBlockedIpSet() {
    return new Set((ipBlockData.blocked || []).map((b) => b.ip_address));
}

function applyBlockedState(row) {
    const ip = row.client_ip;
    return {
        ...row,
        is_blocked: ip ? getBlockedIpSet().has(ip) : false,
    };
}

function getIpBlockRows() {
    const records = (ipBlockData.inquiry_records || []).map(applyBlockedState);
    const seenIps = new Set(records.map((r) => r.client_ip).filter(Boolean));
    const blockedSet = getBlockedIpSet();
    const extra = (ipBlockData.inquiry_ips || [])
        .filter((row) => row.ip_address && !seenIps.has(row.ip_address))
        .map((row) => ({
            id: null,
            name: '-',
            phone: '-',
            car_name: `접수 ${row.inquiry_count || 1}회`,
            client_ip: row.ip_address,
            created_at: row.last_seen,
            is_blocked: blockedSet.has(row.ip_address),
        }));
    return [...records, ...extra].sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || ''))
    );
}

function escapeAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;');
}

function initIpBlockListDelegation() {
    const tbody = document.getElementById('ipblockListBody');
    const modalBody = document.getElementById('modalBody');
    const handler = (e) => {
        const blockBtn = e.target.closest('[data-action="block-ip"]');
        if (blockBtn) {
            e.preventDefault();
            blockIpAddress(blockBtn.dataset.ip, blockBtn.dataset.reason || '');
            return;
        }
        const unblockBtn = e.target.closest('[data-action="unblock-ip"]');
        if (unblockBtn) {
            e.preventDefault();
            unblockIpAddress(unblockBtn.dataset.ip);
        }
    };
    if (tbody && !tbody.dataset.ipblockBound) {
        tbody.dataset.ipblockBound = '1';
        tbody.addEventListener('click', handler);
    }
    if (modalBody && !modalBody.dataset.ipblockBound) {
        modalBody.dataset.ipblockBound = '1';
        modalBody.addEventListener('click', handler);
    }
    const blockedBody = document.getElementById('ipblockBlockedBody');
    if (blockedBody && !blockedBody.dataset.ipblockBound) {
        blockedBody.dataset.ipblockBound = '1';
        blockedBody.addEventListener('click', handler);
    }
}

function renderIpBlockStatusCell(row) {
    if (!row.client_ip) return '<span class="text-muted">-</span>';
    if (row.is_blocked) return '<span class="status-badge completed">차단됨</span>';
    return '<span class="status-badge new">정상</span>';
}

function renderIpBlockActionCell(row) {
    if (!row.client_ip) return '<span class="text-muted">-</span>';
    const ip = escapeAttr(row.client_ip);
    if (row.is_blocked) {
        return `<button type="button" class="btn-action" data-action="unblock-ip" data-ip="${ip}">차단해제</button>`;
    }
    const reason = row.id ? `문의 #${row.id}` : row.client_ip;
    return `<button type="button" class="btn-action btn-delete" data-action="block-ip" data-ip="${ip}" data-reason="${escapeAttr(reason)}">차단하기</button>`;
}

function renderIpBlockPagination() {
    const pagination = document.getElementById('ipblockPagination');
    if (!pagination) return;

    const list = getIpBlockRows();
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / IPBLOCK_PER_PAGE));
    if (ipBlockPage > totalPages) ipBlockPage = totalPages;

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = `<button type="button" class="pagination-btn" ${ipBlockPage === 1 ? 'disabled' : ''} onclick="changeIpBlockPage(${ipBlockPage - 1})">이전</button>`;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= ipBlockPage - 2 && i <= ipBlockPage + 2)) {
            html += `<button type="button" class="pagination-btn ${i === ipBlockPage ? 'active' : ''}" onclick="changeIpBlockPage(${i})">${i}</button>`;
        } else if (i === ipBlockPage - 3 || i === ipBlockPage + 3) {
            html += '<span class="pagination-ellipsis">…</span>';
        }
    }
    html += `<button type="button" class="pagination-btn" ${ipBlockPage === totalPages ? 'disabled' : ''} onclick="changeIpBlockPage(${ipBlockPage + 1})">다음</button>`;
    pagination.innerHTML = html;
}

window.changeIpBlockPage = function(page) {
    ipBlockPage = page;
    renderIpBlockList();
};

async function loadIpBlockData() {
    const tbody = document.getElementById('ipblockListBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="loading">불러오는 중...</td></tr>';
    const blockedBody = document.getElementById('ipblockBlockedBody');
    if (blockedBody) blockedBody.innerHTML = '<tr><td colspan="4" class="loading">불러오는 중...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/blocked-ips`);
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || '불러오기 실패');
        }
        ipBlockData = data;
        ipBlockPage = 1;
        renderIpBlockList();
        renderIpBlockBlockedList();
    } catch (error) {
        console.error('loadIpBlockData:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="loading">데이터를 불러오지 못했습니다.</td></tr>';
        if (blockedBody) blockedBody.innerHTML = '<tr><td colspan="4" class="loading">데이터를 불러오지 못했습니다.</td></tr>';
        showError('IP 목록을 불러오지 못했습니다. D1에 sql/blocked_ips.sql 실행이 필요할 수 있습니다.');
    }
}

function renderIpBlockList() {
    const tbody = document.getElementById('ipblockListBody');
    if (!tbody) return;

    const list = getIpBlockRows();
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / IPBLOCK_PER_PAGE));
    if (ipBlockPage > totalPages) ipBlockPage = totalPages;

    const start = (ipBlockPage - 1) * IPBLOCK_PER_PAGE;
    const pageRows = list.slice(start, start + IPBLOCK_PER_PAGE);

    if (!total) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">표시할 데이터가 없습니다.</td></tr>';
        renderIpBlockPagination();
        return;
    }

    tbody.innerHTML = pageRows.map((row) => `
        <tr class="${row.is_blocked ? 'ipblock-row-blocked' : ''}">
            <td>${formatKoreanDateTime(row.created_at)}</td>
            <td>${escapeHtml(row.name || '-')}</td>
            <td>${escapeHtml(row.phone || '-')}</td>
            <td>${escapeHtml(row.car_name || '-')}</td>
            <td>${row.client_ip ? escapeHtml(row.client_ip) : '-'}</td>
            <td>${renderIpBlockStatusCell(row)}</td>
            <td>${renderIpBlockActionCell(row)}</td>
        </tr>
    `).join('');

    renderIpBlockPagination();
}

function renderIpBlockBlockedList() {
    const tbody = document.getElementById('ipblockBlockedBody');
    if (!tbody) return;

    const list = ipBlockData.blocked || [];
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">차단된 IP가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((row) => {
        const ip = escapeAttr(row.ip_address);
        return `
        <tr>
            <td>${escapeHtml(row.ip_address)}</td>
            <td>${escapeHtml(row.reason || '-')}</td>
            <td>${formatKoreanDateTime(row.created_at)}</td>
            <td><button type="button" class="btn-action" data-action="unblock-ip" data-ip="${ip}">차단해제</button></td>
        </tr>`;
    }).join('');
}

async function blockIpAddress(ip, reason) {
    if (!ip) {
        showError('IP 주소를 입력해주세요.');
        return;
    }
    showConfirmModal({
        title: 'IP 차단',
        message: `${ip} 을(를) 차단하시겠습니까?\n차단 후 해당 IP에서는 문의 접수가 불가합니다.`,
        confirmText: '차단하기',
        cancelText: '취소',
        danger: true,
        onConfirm: async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/blocked-ips`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip, reason: reason || null }),
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    showError(data.error || 'IP 차단에 실패했습니다.');
                    return;
                }
                showMessageModal('IP가 차단되었습니다.', 'success');
                await prefetchBlockedIps();
                const onIpPage = document.getElementById('ipblockPage')?.classList.contains('active');
                if (onIpPage) loadIpBlockData();
            } catch (error) {
                console.error('blockIpAddress:', error);
                showError('IP 차단 중 오류가 발생했습니다.');
            }
        },
    });
}

async function unblockIpAddress(ip) {
    if (!ip) return;
    showConfirmModal({
        title: 'IP 차단 해제',
        message: `${ip} 차단을 해제하시겠습니까?`,
        confirmText: '차단해제',
        cancelText: '취소',
        danger: false,
        onConfirm: async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/blocked-ips?ip=${encodeURIComponent(ip)}`, {
                    method: 'DELETE',
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    showError(data.error || '차단 해제에 실패했습니다.');
                    return;
                }
                showMessageModal('IP 차단이 해제되었습니다.', 'success');
                await prefetchBlockedIps();
                const onIpPage = document.getElementById('ipblockPage')?.classList.contains('active');
                if (onIpPage) loadIpBlockData();
            } catch (error) {
                console.error('unblockIpAddress:', error);
                showError('차단 해제 중 오류가 발생했습니다.');
            }
        },
    });
}

window.blockIpAddress = blockIpAddress;
window.unblockIpAddress = unblockIpAddress;

// 문의 목록 불러오기
async function loadInquiries() {
    try {
        const response = await fetch(`${API_BASE_URL}/inquiries`);
        
        if (!response.ok) {
            throw new Error('데이터를 불러오는데 실패했습니다.');
        }

        const data = await response.json();
        allInquiries = data.inquiries || [];
        
        // 날짜 기준으로 정렬 (최신순)
        allInquiries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        filterInquiries();
    } catch (error) {
        console.error('Error loading inquiries:', error);
        showError('데이터를 불러오는데 실패했습니다. API 엔드포인트를 확인해주세요.');
    }
}

// 문의 필터링
function filterInquiries() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;

    filteredInquiries = allInquiries.filter(inquiry => {
        const matchesSearch = !searchTerm || 
            inquiry.name?.toLowerCase().includes(searchTerm) ||
            inquiry.phone?.includes(searchTerm);
        
        const matchesStatus = !statusFilter || inquiry.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    currentPage = 1;
    renderInquiries();
    renderPagination();
}

// 문의 목록 렌더링
function renderInquiries() {
    const tbody = document.getElementById('inquiriesTableBody');
    
    if (filteredInquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">조회된 문의가 없습니다.</td></tr>';
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageInquiries = filteredInquiries.slice(start, end);

    tbody.innerHTML = pageInquiries.map((inquiry, index) => {
        const rowIndex = start + index + 1;
        const createdDate = formatKoreanDateTime(inquiry.created_at);
        
        return `
            <tr>
                <td>${rowIndex}</td>
                <td>${createdDate}</td>
                <td>${escapeHtml(inquiry.name || '-')}</td>
                <td>${formatPhone(inquiry.phone || '-')}</td>
                <td>${escapeHtml(inquiry.affiliation || '-')}</td>
                <td>${escapeHtml(inquiry.vehicle_type || '-')}</td>
                <td>${escapeHtml(inquiry.car_name || '-')}</td>
                <td><span class="status-badge ${inquiry.status || 'new'}">${getStatusText(inquiry.status || 'new')}</span></td>
                    <td>
                    <button class="btn-action" onclick="showDetail(${inquiry.id})">상세</button>
                    <button class="btn-action" onclick="updateStatus(${inquiry.id}, '${getNextStatus(inquiry.status || 'new')}')">${getNextStatusText(inquiry.status || 'new')}</button>
                    <button class="btn-action btn-delete" onclick="deleteInquiry(${inquiry.id})">삭제</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 페이지네이션 렌더링
function renderPagination() {
    const totalPages = Math.ceil(filteredInquiries.length / itemsPerPage);
    const pagination = document.getElementById('pagination');

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = '';

    // 이전 버튼
    paginationHTML += `
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
            이전
        </button>
    `;

    // 페이지 번호
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHTML += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
    }

    // 다음 버튼
    paginationHTML += `
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
            다음
        </button>
    `;

    pagination.innerHTML = paginationHTML;
}

// 페이지 변경
function changePage(page) {
    currentPage = page;
    renderInquiries();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 상세 정보 보기
async function showDetail(id) {
    const inquiry = allInquiries.find(item => item.id === id);
    if (!inquiry) {
        showError('문의 정보를 찾을 수 없습니다.');
        return;
    }

    const modalBody = document.getElementById('modalBody');
    const createdDate = formatKoreanDateTime(inquiry.created_at);
    const ipBlocked = inquiry.client_ip && getBlockedIpSet().has(inquiry.client_ip);
    const ipActionBtn = inquiry.client_ip
        ? (ipBlocked
            ? `<button type="button" class="btn-action" style="margin-top:8px" data-action="unblock-ip" data-ip="${escapeAttr(inquiry.client_ip)}">차단해제</button>`
            : `<button type="button" class="btn-action btn-delete" style="margin-top:8px" data-action="block-ip" data-ip="${escapeAttr(inquiry.client_ip)}" data-reason="${escapeAttr('문의 #' + inquiry.id)}">차단하기</button>`)
        : '';

    modalBody.innerHTML = `
        <div class="modal-detail-layout">
            <div class="detail-left">
                <div class="detail-item">
                    <div class="detail-label">번호</div>
                    <div class="detail-value">${inquiry.id}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">신청일시</div>
                    <div class="detail-value">${createdDate}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">성함</div>
                    <div class="detail-value">${escapeHtml(inquiry.name || '-')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">연락처</div>
                    <div class="detail-value">${formatPhone(inquiry.phone || '-')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">소속 구분</div>
                    <div class="detail-value">${escapeHtml(inquiry.affiliation || '-')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">차량 유형</div>
                    <div class="detail-value">${escapeHtml(inquiry.vehicle_type || '-')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">차량명</div>
                    <div class="detail-value">${escapeHtml(inquiry.car_name || '-')}</div>
                </div>
                ${inquiry.client_ip ? `
                <div class="detail-item">
                    <div class="detail-label">접수 IP</div>
                    <div class="detail-value">
                        <code>${escapeHtml(inquiry.client_ip)}</code>
                        ${ipActionBtn}
                    </div>
                </div>
                ` : ''}
                <div class="detail-item">
                    <div class="detail-label">상태</div>
                    <div class="detail-value">
                        <select id="modalStatus" class="filter-select" style="width: 100%; margin-top: 10px;">
                            <option value="new" ${inquiry.status === 'new' ? 'selected' : ''}>신규</option>
                            <option value="processing" ${inquiry.status === 'processing' ? 'selected' : ''}>처리중</option>
                            <option value="completed" ${inquiry.status === 'completed' ? 'selected' : ''}>완료</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="detail-right">
                <div class="detail-item">
                    <div class="detail-label">메모</div>
                    <textarea id="modalMemo" class="memo-textarea" placeholder="메모를 입력하세요...">${escapeHtml(inquiry.memo || '')}</textarea>
                </div>
            </div>
        </div>
    `;

    // 저장 버튼 이벤트
    document.getElementById('saveBtn').onclick = function() {
        const newStatus = document.getElementById('modalStatus').value;
        const newMemo = document.getElementById('modalMemo').value;
        updateInquiry(inquiry.id, newStatus, newMemo);
    };

    document.getElementById('detailModal').classList.add('active');
}

// 모달 닫기
function closeModal() {
    document.getElementById('detailModal').classList.remove('active');
}

// 상태 업데이트
async function updateStatus(id, status) {
    try {
        const response = await fetch(`${API_BASE_URL}/inquiries/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status }),
        });

        if (!response.ok) {
            throw new Error('상태 업데이트에 실패했습니다.');
        }

        // 로컬 상태 업데이트
        const inquiry = allInquiries.find(item => item.id === id);
        if (inquiry) {
            inquiry.status = status;
        }

        renderInquiries();
        closeModal();
    } catch (error) {
        console.error('Error updating status:', error);
        showError('상태 업데이트에 실패했습니다.');
    }
}

function memoHasBlockedPatterns(memo) {
    const t = String(memo || '').trim();
    if (!t) return false;

    // 초성/자모(ㄱ-ㅎ,ㅏ-ㅣ) 연속 입력 차단 (문장 중 일부라도 있으면 차단)
    if (/[ㄱ-ㅎㅏ-ㅣ]{2,}/.test(t)) return true;

    // 연속 번호 차단: 4자리 이상 동일숫자 반복 또는 4자리 연속 증가/감소
    if (/(\d)\1{3,}/.test(t)) return true;
    const minLen = 4;
    for (let i = 0; i <= t.length - minLen; i++) {
        const slice = t.slice(i, i + minLen);
        if (!/^\d{4}$/.test(slice)) continue;
        let asc = true;
        let desc = true;
        for (let j = 1; j < minLen; j++) {
            const cur = slice.charCodeAt(j) - 48;
            const prev = slice.charCodeAt(j - 1) - 48;
            if (cur !== prev + 1) asc = false;
            if (cur !== prev - 1) desc = false;
        }
        if (asc || desc) return true;
    }

    if (typeof hasBannedWord === 'function' && hasBannedWord(t)) return true;

    return false;
}

async function updateInquiry(id, status, memo) {
    // 메모 검증 (서버에서도 동일하게 체크하지만, 관리자 UX를 위해 먼저 막음)
    if (memo != null && String(memo).trim() !== '' && memoHasBlockedPatterns(memo)) {
        showMessageModal('메모에 초성(자음/모음만) 또는 연속번호/부적절한 단어가 포함되어 저장할 수 없습니다.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/inquiries/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status, memo }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || '정보 업데이트에 실패했습니다.');
        }

        // 로컬 상태 업데이트
        const inquiry = allInquiries.find(item => item.id === id);
        if (inquiry) {
            inquiry.status = status;
            inquiry.memo = memo || null;
        }

        renderInquiries();
        closeModal();
        showMessageModal('저장되었습니다.', 'success');
    } catch (error) {
        console.error('Error updating inquiry:', error);
        showMessageModal(String(error && error.message ? error.message : '정보 업데이트에 실패했습니다.'), 'error');
    }
}

// 문의 삭제
async function deleteInquiry(id) {
    showConfirmModal({
        title: '문의 삭제',
        message: '정말 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.',
        confirmText: '삭제',
        cancelText: '취소',
        danger: true,
        onConfirm: () => doDeleteInquiry(id)
    });
}

async function doDeleteInquiry(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/inquiries/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('문의 삭제에 실패했습니다.');
        }

        // 로컬 상태에서 제거
        allInquiries = allInquiries.filter(item => item.id !== id);
        filteredInquiries = filteredInquiries.filter(item => item.id !== id);

        renderInquiries();
        renderPagination();
        showMessageModal('문의가 삭제되었습니다.', 'success');
    } catch (error) {
        console.error('Error deleting inquiry:', error);
        showError('문의 삭제에 실패했습니다.');
    }
}

// 인라인 onclick에서 접근 가능하도록 전역 등록
window.showDetail = showDetail;
window.updateStatus = updateStatus;
window.deleteInquiry = deleteInquiry;

// 비밀번호 변경
document.addEventListener('DOMContentLoaded', function() {
    const passwordForm = document.getElementById('passwordChangeForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const messageDiv = document.getElementById('passwordMessage');
            
            // 새 비밀번호와 확인이 일치하는지 체크 (간단 체크)
            if (newPassword !== confirmPassword) {
                messageDiv.textContent = '새 비밀번호가 일치하지 않습니다.';
                messageDiv.className = 'password-message error';
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        currentPassword: currentPassword,
                        newPassword: newPassword
                    }),
                });

                const result = await response.json();
                
                if (result.success) {
                    messageDiv.textContent = '비밀번호가 성공적으로 변경되었습니다.';
                    messageDiv.className = 'password-message success';
                    passwordForm.reset();
                } else {
                    messageDiv.textContent = result.error || '비밀번호 변경에 실패했습니다.';
                    messageDiv.className = 'password-message error';
                }
            } catch (error) {
                console.error('Error changing password:', error);
                messageDiv.textContent = '비밀번호 변경 중 오류가 발생했습니다.';
                messageDiv.className = 'password-message error';
            }
        });
    }
});

// 유틸리티 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 한국 시간대로 날짜 형식 변환
function formatKoreanDateTime(dateString) {
    if (!dateString) return '-';
    
    try {
        // SQLite에서 가져온 날짜 문자열을 파싱
        // 형식: 'YYYY-MM-DD HH:MM:SS' (이미 한국 시간)
        let date;
        
        if (dateString.includes('T')) {
            // ISO 형식인 경우
            date = new Date(dateString);
        } else {
            // SQLite 형식인 경우 (YYYY-MM-DD HH:MM:SS)
            // 문자열을 그대로 한국 시간으로 해석
            // 시간대 정보를 명시적으로 추가하여 파싱
            const datePart = dateString.substring(0, 10); // YYYY-MM-DD
            const timePart = dateString.substring(11, 19) || '00:00:00'; // HH:MM:SS
            // +09:00을 추가하여 한국 시간대임을 명시
            date = new Date(datePart + 'T' + timePart + '+09:00');
        }
        
        // 한국 시간대로 표시 (이미 한국 시간이므로 그대로 표시)
        return date.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

function formatPhone(phone) {
    if (!phone || phone === '-') return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (cleaned.length === 10) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return phone;
}

function getStatusText(status) {
    const statusMap = {
        'new': '신규',
        'processing': '처리중',
        'completed': '완료'
    };
    return statusMap[status] || '신규';
}

function getNextStatus(currentStatus) {
    const statusFlow = {
        'new': 'processing',
        'processing': 'completed',
        'completed': 'new'
    };
    return statusFlow[currentStatus] || 'processing';
}

function getNextStatusText(currentStatus) {
    const statusFlow = {
        'new': '처리시작',
        'processing': '완료처리',
        'completed': '신규로'
    };
    return statusFlow[currentStatus] || '처리시작';
}

// 알림 모달 (success | error | info)
function showMessageModal(message, type) {
    type = type || 'info';
    const modal = document.getElementById('messageModal');
    const iconEl = document.getElementById('messageModalIcon');
    const textEl = document.getElementById('messageModalText');
    if (!modal || !iconEl || !textEl) return;

    const icons = {
        success: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        error: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        info: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    iconEl.className = 'message-modal-icon ' + type;
    iconEl.innerHTML = icons[type] || icons.info;
    textEl.textContent = message;
    modal.classList.add('active');
}

// 확인 모달용 콜백 (한 번만 등록한 버튼에서 사용)
let _confirmModalOnConfirm = null;

// 확인 모달 (확인 시 onConfirm 호출)
function showConfirmModal(options) {
    const { title = '확인', message, confirmText = '확인', cancelText = '취소', onConfirm, danger = true } = options || {};
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const textEl = document.getElementById('confirmModalText');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    if (!modal || !textEl || !confirmBtn) return;

    titleEl.textContent = title;
    textEl.textContent = message;
    cancelBtn.textContent = cancelText;
    confirmBtn.textContent = confirmText;
    confirmBtn.classList.toggle('btn-danger', danger);
    _confirmModalOnConfirm = typeof onConfirm === 'function' ? onConfirm : null;
    modal.classList.add('active');
}

// 기존 showError를 모달로
function showError(message) {
    showMessageModal(message, 'error');
}

// ========== 고객후기 관리 기능 ==========

// 고객후기 목록 불러오기
async function loadReviews() {
    const reviewsList = document.getElementById('reviewsList');
    if (!reviewsList) return;

    try {
        reviewsList.innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';
        
        const response = await fetch(`${API_BASE_URL}/reviews`);
        const data = await response.json();

        if (data.success && data.reviews) {
            updateReviewStats(data.reviews);
            renderReviews(data.reviews);
        } else {
            updateReviewStats([]);
            reviewsList.innerHTML = '<div class="error">데이터를 불러오는데 실패했습니다.</div>';
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        updateReviewStats([]);
        reviewsList.innerHTML = '<div class="error">데이터를 불러오는데 실패했습니다.</div>';
    }
}

// 고객후기 통계 업데이트 (전체 / 활성 / 비활성)
function updateReviewStats(reviews) {
    const totalEl = document.getElementById('totalReviews');
    const activeEl = document.getElementById('activeReviews');
    const inactiveEl = document.getElementById('inactiveReviews');
    if (!totalEl || !activeEl || !inactiveEl) return;

    const total = reviews.length;
    const active = reviews.filter(function(r) { return r.is_active === 1 || r.is_active === true; }).length;
    const inactive = total - active;

    totalEl.textContent = total;
    activeEl.textContent = active;
    inactiveEl.textContent = inactive;
}

// 고객후기 목록 렌더링
function renderReviews(reviews) {
    const reviewsList = document.getElementById('reviewsList');
    if (!reviewsList) return;

    if (reviews.length === 0) {
        reviewsList.innerHTML = '<div class="empty">등록된 고객후기가 없습니다.</div>';
        return;
    }

    reviewsList.innerHTML = reviews.map(function(review) {
        var imgUrl = (review.images && review.images[0]) || review.image_url || '';
        return '<div class="review-item" data-id="' + review.id + '">' +
            '<div class="review-image">' +
            '<img src="' + imgUrl + '" alt="고객후기 이미지" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23ddd%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E이미지 없음%3C/text%3E%3C/svg%3E\'">' +
            '</div>' +
            '<div class="review-content">' +
                '<div class="review-title">' + (review.title || '(타이틀 없음)') + '</div>' +
                '<div class="review-text">' + (review.text_content || '(설명 없음)') + '</div>' +
                '<div class="review-meta">' +
                    '<span>순서: ' + review.display_order + '</span>' +
                    '<span class="status ' + (review.is_active ? 'active' : 'inactive') + '">' + (review.is_active ? '활성' : '비활성') + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="review-actions">' +
                '<button class="btn-small btn-primary" onclick="editReview(' + review.id + ')">수정</button>' +
                '<button class="btn-small btn-danger" onclick="deleteReview(' + review.id + ')">삭제</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

// 고객후기 모달 열기
function openReviewModal(reviewId = null) {
    const modal = document.getElementById('reviewModal');
    const form = document.getElementById('reviewForm');
    const modalTitle = document.getElementById('reviewModalTitle');
    const imagePreview = document.getElementById('imagePreview');

    if (!modal || !form) return;

    reviewCurrentFiles.forEach(function(item) {
        if (item.type === 'file' && item._objectUrl) URL.revokeObjectURL(item._objectUrl);
    });
    reviewCurrentFiles = [];

    if (reviewId) {
        modalTitle.textContent = '고객후기 수정';
        document.getElementById('reviewId').value = reviewId;
        loadReviewData(reviewId);
    } else {
        modalTitle.textContent = '고객후기 추가';
        form.reset();
        document.getElementById('reviewId').value = '';
        document.getElementById('reviewTitle').value = '';
        document.getElementById('reviewText').value = '';
        imagePreview.innerHTML = '';
        var imInput = document.getElementById('reviewImages');
        if (imInput) imInput.value = '';
        renderReviewPreviews();
    }

    modal.classList.add('active');
}

// 고객후기 데이터 불러오기
async function loadReviewData(reviewId) {
    try {
        const response = await fetch(`${API_BASE_URL}/reviews`);
        const data = await response.json();

        if (data.success && data.reviews) {
            const review = data.reviews.find(r => r.id === reviewId);
            if (review) {
                document.getElementById('reviewTitle').value = review.title || '';
                document.getElementById('reviewText').value = review.text_content || '';
                document.getElementById('reviewOrder').value = review.display_order || 0;
                document.getElementById('reviewActive').checked = review.is_active === 1;
                var imgs = review.images && Array.isArray(review.images) && review.images.length > 0
                    ? review.images
                    : (review.image_url ? [review.image_url] : []);
                reviewCurrentFiles = imgs.map(function(url) { return { type: 'url', url: url }; });
                renderReviewPreviews();
            }
        }
    } catch (error) {
        console.error('Error loading review data:', error);
    }
}

var MAX_REVIEW_IMAGES = 5;
// 고객후기 모달에서 선택/드롭한 파일 또는 기존 URL (드래그 시 input.files 할당 불가 대비)
var reviewCurrentFiles = []; // { type: 'file', file: File } | { type: 'url', url: string }

function addReviewFiles(files) {
    if (!files || files.length === 0) return;
    for (var i = 0; i < files.length && reviewCurrentFiles.length < MAX_REVIEW_IMAGES; i++) {
        if (files[i].type && files[i].type.indexOf('image/') === 0) {
            reviewCurrentFiles.push({ type: 'file', file: files[i] });
        }
    }
    renderReviewPreviews();
}

function removeReviewFile(index) {
    reviewCurrentFiles.splice(index, 1);
    renderReviewPreviews();
}

function renderReviewPreviews() {
    var imagePreview = document.getElementById('imagePreview');
    if (!imagePreview) return;
    imagePreview.innerHTML = '';
    reviewCurrentFiles.forEach(function(item, idx) {
        var div = document.createElement('div');
        div.className = 'preview-item';
        var src = item.type === 'file'
            ? (item._objectUrl || (item._objectUrl = URL.createObjectURL(item.file)))
            : item.url;
        var label = '#' + (idx + 1) + (idx === 0 ? ' (대표)' : '');
        div.innerHTML =
            '<button type="button" class="preview-remove" aria-label="이미지 삭제" data-index="' + idx + '">&times;</button>' +
            '<img src="' + src + '" alt="미리보기 ' + (idx + 1) + '">' +
            '<span>' + label + '</span>';
        imagePreview.appendChild(div);
    });
    imagePreview.querySelectorAll('.preview-remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var i = parseInt(this.getAttribute('data-index'), 10);
            var item = reviewCurrentFiles[i];
            if (item && item.type === 'file' && item._objectUrl) URL.revokeObjectURL(item._objectUrl);
            removeReviewFile(i);
        });
    });
}

function previewReviewImages(files) {
    if (!files || files.length === 0) return;
    addReviewFiles(Array.prototype.slice.call(files));
}

async function uploadOneImage(file) {
    if (file.size > 5 * 1024 * 1024) return null;
    try {
        var form = new FormData();
        form.append('image', file);
        var res = await fetch(API_BASE_URL + '/upload-image', { method: 'POST', body: form });
        var data = await res.json();
        if (data.success) return data.url;
        return await fileToBase64(file);
    } catch (e) {
        return await fileToBase64(file);
    }
}

// 고객후기 저장 (이미지 1~5장)
async function saveReview() {
    var reviewId = document.getElementById('reviewId').value;
    var title = document.getElementById('reviewTitle').value.trim();
    var textContent = document.getElementById('reviewText').value;
    var displayOrder = parseInt(document.getElementById('reviewOrder').value, 10) || 0;
    var isActive = document.getElementById('reviewActive').checked;

    var imagesArr = [];
    for (var i = 0; i < reviewCurrentFiles.length; i++) {
        var item = reviewCurrentFiles[i];
        if (item.type === 'file') {
            if (item.file.size > 5 * 1024 * 1024) {
                showMessageModal('각 이미지는 5MB 이하여야 합니다.', 'error');
                return;
            }
            var url = await uploadOneImage(item.file);
            if (url) imagesArr.push(url);
        } else if (item.type === 'url' && item.url) {
            imagesArr.push(item.url);
        }
    }
    if (imagesArr.length === 0) {
        showMessageModal('이미지를 1장 이상 선택해주세요.', 'error');
        return;
    }

    try {
        var response = await fetch(API_BASE_URL + '/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: reviewId || null,
                image_url: imagesArr[0],
                images: imagesArr,
                title: title || null,
                text_content: textContent,
                display_order: displayOrder,
                is_active: isActive
            }),
        });

        var data = await response.json();
        if (data.success) {
            showMessageModal(reviewId ? '고객후기가 수정되었습니다.' : '고객후기가 추가되었습니다.', 'success');
            closeReviewModal();
            loadReviews();
        } else {
            showMessageModal('저장에 실패했습니다: ' + (data.error || '알 수 없는 오류'), 'error');
        }
    } catch (error) {
        console.error('Error saving review:', error);
        showMessageModal('저장 중 오류가 발생했습니다.', 'error');
    }
}

// 파일을 Base64로 변환
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 고객후기 수정
function editReview(reviewId) {
    openReviewModal(reviewId);
}

// 고객후기 삭제
function deleteReview(reviewId) {
    showConfirmModal({
        title: '고객후기 삭제',
        message: '정말 삭제하시겠습니까?',
        confirmText: '삭제',
        cancelText: '취소',
        danger: true,
        onConfirm: () => doDeleteReview(reviewId)
    });
}

async function doDeleteReview(reviewId) {
    try {
        const response = await fetch(`${API_BASE_URL}/reviews?id=${reviewId}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (data.success) {
            showMessageModal('고객후기가 삭제되었습니다.', 'success');
            loadReviews();
        } else {
            showMessageModal('삭제에 실패했습니다: ' + (data.error || '알 수 없는 오류'), 'error');
        }
    } catch (error) {
        console.error('Error deleting review:', error);
        showMessageModal('삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 고객후기 모달 닫기
function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) {
        modal.classList.remove('active');
    }
    const form = document.getElementById('reviewForm');
    if (form) {
        form.reset();
    }
    reviewCurrentFiles.forEach(function(item) {
        if (item.type === 'file' && item._objectUrl) URL.revokeObjectURL(item._objectUrl);
    });
    reviewCurrentFiles = [];
    var imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.innerHTML = '';
    }
}
