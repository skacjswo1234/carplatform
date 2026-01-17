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
    loadInquiries();
});

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
        loadInquiries();
    });

    // 검색 및 필터
    document.getElementById('searchInput').addEventListener('input', function() {
        filterInquiries();
    });

    document.getElementById('filterStatus').addEventListener('change', function() {
        filterInquiries();
    });

    // 모달 닫기
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    
    const modal = document.getElementById('detailModal');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
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
        'password': '비밀번호 변경'
    };
    document.getElementById('pageTitle').textContent = titles[page] || '';
}

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

    modalBody.innerHTML = `
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
    `;

    // 저장 버튼 이벤트
    document.getElementById('saveBtn').onclick = function() {
        const newStatus = document.getElementById('modalStatus').value;
        updateStatus(inquiry.id, newStatus);
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

function showError(message) {
    alert(message);
}
