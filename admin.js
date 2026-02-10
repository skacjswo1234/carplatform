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

    const reviewImageInput = document.getElementById('reviewImage');
    if (reviewImageInput) {
        reviewImageInput.addEventListener('change', function(e) {
            previewImage(e.target.files[0]);
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
        'reviews': '고객후기 관리',
        'password': '비밀번호 변경'
    };
    document.getElementById('pageTitle').textContent = titles[page] || '';

    // 페이지별 초기화
    if (page === 'reviews') {
        loadReviews();
    }
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
            renderReviews(data.reviews);
        } else {
            reviewsList.innerHTML = '<div class="error">데이터를 불러오는데 실패했습니다.</div>';
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        reviewsList.innerHTML = '<div class="error">데이터를 불러오는데 실패했습니다.</div>';
    }
}

// 고객후기 목록 렌더링
function renderReviews(reviews) {
    const reviewsList = document.getElementById('reviewsList');
    if (!reviewsList) return;

    if (reviews.length === 0) {
        reviewsList.innerHTML = '<div class="empty">등록된 고객후기가 없습니다.</div>';
        return;
    }

    reviewsList.innerHTML = reviews.map(review => `
        <div class="review-item" data-id="${review.id}">
            <div class="review-image">
                <img src="${review.image_url}" alt="고객후기 이미지" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23ddd%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E이미지 없음%3C/text%3E%3C/svg%3E'">
            </div>
            <div class="review-content">
                <div class="review-text">${review.text_content || '(텍스트 없음)'}</div>
                <div class="review-meta">
                    <span>순서: ${review.display_order}</span>
                    <span class="status ${review.is_active ? 'active' : 'inactive'}">${review.is_active ? '활성' : '비활성'}</span>
                </div>
            </div>
            <div class="review-actions">
                <button class="btn-small btn-primary" onclick="editReview(${review.id})">수정</button>
                <button class="btn-small btn-danger" onclick="deleteReview(${review.id})">삭제</button>
            </div>
        </div>
    `).join('');
}

// 고객후기 모달 열기
function openReviewModal(reviewId = null) {
    const modal = document.getElementById('reviewModal');
    const form = document.getElementById('reviewForm');
    const modalTitle = document.getElementById('reviewModalTitle');
    const imagePreview = document.getElementById('imagePreview');
    
    if (!modal || !form) return;

    if (reviewId) {
        modalTitle.textContent = '고객후기 수정';
        document.getElementById('reviewId').value = reviewId;
        // 기존 데이터 불러오기
        loadReviewData(reviewId);
    } else {
        modalTitle.textContent = '고객후기 추가';
        form.reset();
        document.getElementById('reviewId').value = '';
        imagePreview.innerHTML = '';
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
                document.getElementById('reviewText').value = review.text_content || '';
                document.getElementById('reviewOrder').value = review.display_order || 0;
                document.getElementById('reviewActive').checked = review.is_active === 1;
                
                const imagePreview = document.getElementById('imagePreview');
                imagePreview.innerHTML = `<img src="${review.image_url}" alt="미리보기" style="max-width: 100%; max-height: 200px;">`;
            }
        }
    } catch (error) {
        console.error('Error loading review data:', error);
    }
}

// 이미지 미리보기
function previewImage(file) {
    const imagePreview = document.getElementById('imagePreview');
    if (!imagePreview || !file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        imagePreview.innerHTML = `<img src="${e.target.result}" alt="미리보기" style="max-width: 100%; max-height: 200px;">`;
    };
    reader.readAsDataURL(file);
}

// 고객후기 저장
async function saveReview() {
    const form = document.getElementById('reviewForm');
    const reviewId = document.getElementById('reviewId').value;
    const imageInput = document.getElementById('reviewImage');
    const textContent = document.getElementById('reviewText').value;
    const displayOrder = parseInt(document.getElementById('reviewOrder').value) || 0;
    const isActive = document.getElementById('reviewActive').checked;

    // 이미지 처리
    let imageUrl = '';
    
    if (imageInput.files && imageInput.files[0]) {
        // 새 이미지가 선택된 경우 업로드
        const file = imageInput.files[0];
        
        // 파일 크기 체크 (5MB 제한)
        if (file.size > 5 * 1024 * 1024) {
            showMessageModal('이미지 크기는 5MB 이하여야 합니다.', 'error');
            return;
        }

        // R2에 업로드 시도, 실패하면 Base64 사용
        try {
            const uploadFormData = new FormData();
            uploadFormData.append('image', file);
            
            const uploadResponse = await fetch(`${API_BASE_URL}/upload-image`, {
                method: 'POST',
                body: uploadFormData,
            });

            const uploadData = await uploadResponse.json();
            
            if (uploadData.success) {
                imageUrl = uploadData.url;
            } else {
                // R2 업로드 실패 시 Base64로 폴백
                console.warn('R2 업로드 실패, Base64 사용:', uploadData.error);
                imageUrl = await fileToBase64(file);
            }
        } catch (error) {
            // 업로드 API 오류 시 Base64로 폴백
            console.warn('이미지 업로드 오류, Base64 사용:', error);
            imageUrl = await fileToBase64(file);
        }
    } else if (reviewId) {
        // 수정 모드이고 새 이미지가 없으면 기존 이미지 URL 가져오기
        try {
            const response = await fetch(`${API_BASE_URL}/reviews`);
            const data = await response.json();
            if (data.success && data.reviews) {
                const review = data.reviews.find(r => r.id == reviewId);
                if (review) {
                    imageUrl = review.image_url;
                }
            }
        } catch (error) {
            console.error('Error loading existing image:', error);
        }
    }

    if (!imageUrl) {
        showMessageModal('이미지를 선택해주세요.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: reviewId || null,
                image_url: imageUrl,
                text_content: textContent,
                display_order: displayOrder,
                is_active: isActive
            }),
        });

        const data = await response.json();

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
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.innerHTML = '';
    }
}
