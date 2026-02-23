// SQL 인젝션 방지: SELECT, AND, SLEEP 키워드 및 특수문자 필터링
function sanitizeInput(value) {
    if (!value || typeof value !== 'string') return value;
    
    // SQL 인젝션 키워드 검사 (대소문자 무시)
    const sqlKeywords = /\b(SELECT|AND|SLEEP|UNION|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT)\b/gi;
    
    // 특수문자 검사 (SQL 인젝션에 사용되는 문자들)
    const dangerousChars = /["'\\;<>]/g;
    
    if (sqlKeywords.test(value) || dangerousChars.test(value)) {
        return null; // 위험한 입력 감지
    }
    
    return value.trim();
}

// IP 주소 가져오기
async function getClientIP() {
    try {
        const response = await fetch('/api/get-ip', {
            method: 'GET',
        });
        if (response.ok) {
            const data = await response.json();
            return data.ip || 'unknown';
        }
    } catch (error) {
        console.warn('IP 가져오기 실패:', error);
    }
    return 'unknown';
}

// 로딩 오버레이 표시/숨김
function showLoadingOverlay(message = '처리 중...') {
    const overlay = document.getElementById('loadingOverlay');
    const textEl = document.getElementById('loadingText');
    if (overlay) {
        if (textEl) textEl.textContent = message;
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// Alert 모달 표시/숨김
function showAlertModal(message) {
    const modal = document.getElementById('alertModal');
    const messageElement = document.getElementById('alertMessage');
    if (messageElement) {
        messageElement.textContent = message;
    }
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeAlertModal() {
    const modal = document.getElementById('alertModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// 완료 모달 표시/숨김
function showCompletionModal() {
    const modal = document.getElementById('completionModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeCompletionModal() {
    const modal = document.getElementById('completionModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// 알림 표시 함수 (기존 호환성 유지)
function showAlert(message) {
    showAlertModal(message);
}

// 문의 데이터 저장
async function saveInquiry(name, phone, carName) {
    // IP 기반 제한 체크
    const clientIP = await getClientIP();
    
    // IP 제한 체크
    try {
        const limitCheck = await fetch('/api/inquiries/check-limit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ip: clientIP }),
        });
        
        if (limitCheck.ok) {
            const limitResult = await limitCheck.json();
            if (!limitResult.allowed) {
                showAlertModal('문의가 이미 접수되었습니다.\n24시간 후 다시 시도해주세요.');
                return false;
            }
        }
    } catch (error) {
        console.error('제한 체크 오류:', error);
        // 제한 체크 실패 시에도 진행 (서버에서 다시 체크)
    }
    
    // 입력값 sanitization
    const sanitizedName = sanitizeInput(name);
    const sanitizedCarName = sanitizeInput(carName);
    
    if (sanitizedName === null || sanitizedCarName === null) {
        showAlertModal('입력하신 내용에 허용되지 않은 문자가 포함되어 있습니다.\n다시 입력해주세요.');
        return false;
    }
    
    // 전화번호 숫자만 허용 검증
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    if (!/^[0-9]{10,11}$/.test(phoneNumber)) {
        showAlertModal('올바른 연락처를 입력해주세요.\n(숫자만 입력, 10-11자리)');
        return false;
    }
    
    const formData = {
        name: sanitizedName,
        phone: phoneNumber,
        affiliation: null,
        vehicle_type: null,
        car_name: sanitizedCarName,
        ip: clientIP
    };

    try {
        const response = await fetch('/api/inquiries', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.error === 'RATE_LIMIT_EXCEEDED') {
                showAlertModal('문의가 이미 접수되었습니다.\n24시간 후 다시 시도해주세요.');
                return false;
            }
            throw new Error('데이터 저장에 실패했습니다.');
        }

        const result = await response.json();
        if (result.success) {
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error saving inquiry:', error);
        showAlertModal('문의 접수 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.');
        return false;
    }
}

// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initSlider();
    initMobileMenu();
    initModals();
    // initPopularSection(); // h-6은 고객후기 섹션으로 변경됨
    initReviewSection();
    initForms();
    initSmoothScroll();
    initHeaderScroll();
    initMiniConsultation();
    initTopButton();
    initMobileConsultBtn();
    initPhoneInputs();
    
    // Alert 모달 외부 클릭 시 닫기
    const alertModal = document.getElementById('alertModal');
    if (alertModal) {
        alertModal.addEventListener('click', function(e) {
            if (e.target === alertModal) {
                closeAlertModal();
            }
        });
    }
    
    // 완료 모달 외부 클릭 시 닫기
    const completionModal = document.getElementById('completionModal');
    if (completionModal) {
        completionModal.addEventListener('click', function(e) {
            if (e.target === completionModal) {
                closeCompletionModal();
            }
        });
    }
});

// 슬라이더 기능
function initSlider() {
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    const totalSlides = slides.length;
    
    if (totalSlides === 0) return;
    
    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.remove('active');
            if (i === index) {
                slide.classList.add('active');
            }
        });
    }
    
    function nextSlide() {
        currentSlide = (currentSlide + 1) % totalSlides;
        showSlide(currentSlide);
    }
    
    function prevSlide() {
        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
        showSlide(currentSlide);
    }
    
    // 자동 슬라이드
    setInterval(nextSlide, 5000);
    
    // 슬라이더 버튼 이벤트
    const nextBtn = document.querySelector('.slider-btn.next');
    const prevBtn = document.querySelector('.slider-btn.prev');
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
}

// 모바일 메뉴
function initMobileMenu() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMobile = document.querySelector('.nav-mobile');
    const navMobileLinks = document.querySelectorAll('.nav-mobile a');
    const mobileMenuClose = document.querySelector('.mobile-menu-close');
    
    if (!mobileMenuToggle || !navMobile) return;
    
    // 메뉴 열기
    mobileMenuToggle.addEventListener('click', () => {
        navMobile.classList.add('active');
        mobileMenuToggle.classList.add('active');
    });
    
    // 메뉴 닫기 (X 버튼)
    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', () => {
            navMobile.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
        });
    }
    
    // 메뉴 링크 클릭 시 닫기
    navMobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMobile.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
        });
    });
}

// 모달 기능
function initModals() {
    const viewButtons = document.querySelectorAll('.view-btn');
    const modals = {
        privacy: document.getElementById('privacyModal'),
        marketing: document.getElementById('marketingModal')
    };
    const modalCloses = document.querySelectorAll('.modal-close');
    
    viewButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const modalType = button.getAttribute('data-modal');
            if (modals[modalType]) {
                modals[modalType].classList.add('active');
            }
        });
    });
    
    modalCloses.forEach(close => {
        close.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
    
    // 모달 배경 클릭 시 닫기
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// 차량 데이터 - 국산차 먼저, 수입차 나중에
const cars = [
    // 국산차 (1페이지)
    { name: '쏘렌토 2.5T 가솔린', image: 'h-6-sorento.png', initialCost: '0원', downPayment: '319,325', monthlyPayment: '568,590', payment: '0원' },
    { name: '그랜저 2.5 가솔린', image: 'h-6-granger.png', initialCost: '0원', downPayment: '333,113', monthlyPayment: '599,280', payment: '0원' },
    { name: '현대 아이오닉5 전기차', image: 'h-6-ionic5.png', initialCost: '0원', downPayment: '351,070', monthlyPayment: '760,980', payment: '0원' },
    { name: '기아 EV6 전기차', image: 'h-6-ev6.png', initialCost: '0원', downPayment: '292,520', monthlyPayment: '691,240', payment: '0원' },
    { name: '현대 코나 1.6 하이브리드', image: 'h-6-kona.png', initialCost: '0원', downPayment: '264,745', monthlyPayment: '488,180', payment: '0원' },
    { name: '스포티지 1.6T 가솔린', image: 'h-6-spotigi.png', initialCost: '0원', downPayment: '255,918', monthlyPayment: '436,260', payment: '0원' },
    { name: '기아 K8 2.5 가솔린', image: 'h-6-k8.png', initialCost: '0원', downPayment: '326,680', monthlyPayment: '564,190', payment: '0원' },
    { name: '쏘나타 2.0 센슈어스', image: 'h-6-sonata.png', initialCost: '0원', downPayment: '283,640', monthlyPayment: '483,230', payment: '0원' },
    // 수입차 (2페이지)
    { name: '아우디 A6 2.0 가솔린 (리스)', image: 'h-6-a6.png', initialCost: '0원', downPayment: '450,500', monthlyPayment: '832,200', payment: '0원' },
    { name: 'BMW 5시리즈 2.0 가솔린 (리스)', image: 'h-6-bmw5.png', initialCost: '0원', downPayment: '464,700', monthlyPayment: '896,400', payment: '0원' },
    { name: '벤츠 E클래스 2.0 가솔린 (리스)', image: 'h-6-benzEclass.png', initialCost: '0원', downPayment: '542,200', monthlyPayment: '933,400', payment: '0원' },
    { name: '제네시스 GV80 2.5 가솔린', image: 'h-6-gv80.png', initialCost: '0원', downPayment: '551,155', monthlyPayment: '1,043,790', payment: '0원' },
    { name: '제네시스 G80 2.5 가솔린', image: 'h-6-g80.png', initialCost: '0원', downPayment: '512,975', monthlyPayment: '931,700', payment: '0원' },
    { name: '카니발 3.5 가솔린 9인승', image: 'h-6-canibal.png', initialCost: '0원', downPayment: '328,700', monthlyPayment: '578,600', payment: '0원' },
    { name: '싼타페 2.5T 가솔린', image: 'h-6-santafe.png', initialCost: '0원', downPayment: '339,375', monthlyPayment: '591,470', payment: '0원' },
    { name: '투싼 1.6T 가솔린', image: 'h-6-tusan.png', initialCost: '0원', downPayment: '278,363', monthlyPayment: '475,420', payment: '0원' }
];

// 차량 카드 생성 (인기차종용) - 초기비용과 선납금 30%만 표시
function createPopularCarCard(car) {
    if (!car) return '';
    return `
        <div class="car-card popular-car-card">
            <img src="images/h-6/${car.image}" alt="${car.name || ''}">
            <div class="car-info">
                <div class="car-name">${car.name || ''}</div>
                <div class="car-price-popular">
                    <div class="car-price-line-popular">
                        <span class="car-price-label-popular">초기비용</span>
                        <span class="car-price-value-large">${car.initialCost || '0원'}</span>
                    </div>
                    <div class="car-price-line-popular">
                        <span class="car-price-label-popular">선납금 30%</span>
                        <span class="car-price-value-large">${car.downPayment || '0원'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 차량 카드 생성 (고객후기용)
function createCarCard(car) {
    return `
        <div class="car-card">
            <img src="images/h-6/${car.image}" alt="${car.name}">
            <div class="car-info">
                <div class="car-name">${car.name}</div>
                <div class="car-price-row">
                    <div class="car-price-left">
                        <div class="car-price-item">
                            <div class="car-price-label">초기비용</div>
                            <div class="car-price-value">${car.initialCost || '0원'}</div>
                        </div>
                        <div class="car-price-item">
                            <div class="car-price-label">선납금 30%</div>
                            <div class="car-price-value">${car.downPayment || '0원'}</div>
                        </div>
                    </div>
                    <div class="car-price-right">
                        <div class="car-price-item">
                            <div class="car-price-label">월납입료</div>
                            <div class="car-price-value">${car.monthlyPayment || '0원'}</div>
                        </div>
                        <div class="car-price-item">
                            <div class="car-price-label">납입금</div>
                            <div class="car-price-value">${car.payment || '0원'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 인기차종 섹션 초기화
function initPopularSection() {
    const popularGrid = document.getElementById('popularCarGrid');
    if (!popularGrid) return;
    
    let popularCurrentPage = 1;
    const popularCarsPerPage = 8;
    
    function getPopularTotalPages() {
        return Math.ceil(cars.length / popularCarsPerPage);
    }
    
    function renderPopularCars(page) {
        if (!cars || cars.length === 0) return;
        const start = (page - 1) * popularCarsPerPage;
        const end = start + popularCarsPerPage;
        const carsToShow = cars.slice(start, end);
        popularGrid.innerHTML = carsToShow.map(createPopularCarCard).join('');
    }
    
    function renderPopularPagination() {
        const popularPagination = document.getElementById('popularPagination');
        if (!popularPagination || !cars || cars.length === 0) return;
        
        popularPagination.innerHTML = '';
        const totalPages = getPopularTotalPages();
        
        for (let i = 1; i <= totalPages; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            button.classList.toggle('active', i === popularCurrentPage);
            button.addEventListener('click', () => {
                popularCurrentPage = i;
                renderPopularCars(popularCurrentPage);
                renderPopularPagination();
                const popularSection = document.getElementById('popular');
                if (popularSection) {
                    window.scrollTo({ top: popularSection.offsetTop - 100, behavior: 'smooth' });
                }
            });
            popularPagination.appendChild(button);
        }
    }
    
    // 초기 렌더링
    renderPopularCars(popularCurrentPage);
    renderPopularPagination();
}

// 고객후기 데이터 (PC 페이징/모바일 슬라이더에서 사용)
let reviewList = [];

// 고객후기 카드 HTML 생성 (대표이미지 → 클릭안내 → 상세타이틀 → 카플랫폼|등록일 → 상품정보)
function formatReviewDate(createdAt) {
    if (!createdAt) return '';
    try {
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}.${m}.${day}`;
    } catch (_) { return ''; }
}

function getReviewMainImage(review) {
    if (review.images && Array.isArray(review.images) && review.images.length > 0) return review.images[0];
    return review.image_url || '';
}

function createReviewCard(review) {
    if (!review) return '';
    const mainImg = getReviewMainImage(review);
    const text = review.text_content ? review.text_content.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const titleStr = review.title ? review.title.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const detailTitle = titleStr || (text ? (text.length > 40 ? text.slice(0, 40) + '…' : text) : '고객 후기');
    const dateStr = formatReviewDate(review.created_at);
    const detailUrl = 'photo-review-detail.html?id=' + encodeURIComponent(review.id);
    return `
        <a href="${detailUrl}" class="review-card-link">
            <article class="review-card">
                <div class="review-card-image-wrap">
                    <img src="${mainImg}" alt="고객후기 대표이미지" class="review-card-image" onerror="this.style.display='none'">
                </div>
                <p class="review-card-click-msg">사진을 클릭하시면 상세내역을 보실 수 있습니다. 클릭♥</p>
                <h3 class="review-card-title">${detailTitle}</h3>
                <p class="review-card-meta">카플랫폼 ${dateStr ? '| ' + dateStr : ''}</p>
                <div class="review-card-product">
                    <span class="review-card-product-label">상품정보&gt;</span>
                    <div class="review-card-product-content">${text || '-'}</div>
                </div>
            </article>
        </a>
    `;
}

// 고객후기 섹션 초기화 (메인: 10개만 표시, 포토후기 더보기로 전체 보기)
async function initReviewSection() {
    const reviewGrid = document.getElementById('reviewGrid');
    if (!reviewGrid) return;

    const setEmptyMessage = (msg) => {
        reviewGrid.innerHTML = `<p style="text-align: center; padding: 40px; color: #666;">${msg}</p>`;
    };

    try {
        const response = await fetch('/api/reviews?active=true');
        const data = await response.json();

        if (!data.success || !data.reviews || data.reviews.length === 0) {
            setEmptyMessage('고객후기를 준비중입니다.');
            return;
        }

        reviewList = data.reviews;
        const showCount = 10;
        const slice = reviewList.slice(0, showCount);
        reviewGrid.innerHTML = slice.map(createReviewCard).join('');
    } catch (error) {
        console.error('Error loading reviews:', error);
        setEmptyMessage('고객후기를 불러오는데 실패했습니다.');
    }
}

// 전화번호 입력란 숫자만 허용
function initPhoneInputs() {
    document.querySelectorAll('input[type="tel"]').forEach(input => {
        input.addEventListener('input', function(e) {
            const value = e.target.value;
            const numericOnly = value.replace(/[^0-9]/g, '');
            if (value !== numericOnly) {
                e.target.value = numericOnly;
                showAlertModal('숫자만 입력 가능합니다.');
            }
        });
        
        input.addEventListener('keypress', function(e) {
            if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                showAlertModal('숫자만 입력 가능합니다.');
            }
        });
        
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numericOnly = pastedText.replace(/[^0-9]/g, '');
            if (pastedText !== numericOnly) {
                showAlertModal('숫자만 입력 가능합니다.');
            }
            e.target.value = numericOnly;
        });
    });
}

// 폼 제출 처리
function initForms() {
    document.querySelectorAll('.consultation-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const privacyCheckbox = form.querySelector('input[type="checkbox"][required]');
            if (!privacyCheckbox || !privacyCheckbox.checked) {
                showAlert('개인정보처리방침 동의는 필수입니다.');
                return;
            }
            
            // 폼 데이터 가져오기
            const inputs = form.querySelectorAll('input[type="text"], input[type="tel"]');
            const nameInput = Array.from(inputs).find(input => input.placeholder === '성함');
            const phoneInput = Array.from(inputs).find(input => input.placeholder === '연락처');
            const carInput = Array.from(inputs).find(input => input.placeholder === '차종');
            
            if (!nameInput || !phoneInput || !carInput) {
                showAlert('모든 필드를 입력해주세요.');
                return;
            }
            
            const name = nameInput.value.trim();
            const phone = phoneInput.value.trim();
            const carName = carInput.value.trim();
            
            // 기본 검증
            if (!name || !phone || !carName) {
                showAlert('모든 필드를 입력해주세요.');
                return;
            }
            
            if (name.length < 2) {
                showAlert('성함을 정확히 입력해주세요.');
                nameInput.focus();
                return;
            }
            
            if (carName.length < 2) {
                showAlert('차종을 정확히 입력해주세요.');
                carInput.focus();
                return;
            }
            
            // 버튼 비활성화
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
            }
            
            // 로딩 오버레이 표시
            showLoadingOverlay('문의 접수 중입니다');
            
            // 문의 저장
            const success = await saveInquiry(name, phone, carName);
            
            // 로딩 오버레이 숨김
            hideLoadingOverlay();
            
            if (success) {
                form.reset();
                // 완료 모달 표시
                showCompletionModal();
            }
            
            // 버튼 활성화
            if (submitBtn) {
                submitBtn.disabled = false;
                // 이미지 버튼인 경우 원래 상태로 복원
                const originalContent = submitBtn.getAttribute('data-original');
                if (originalContent) {
                    submitBtn.innerHTML = originalContent;
                } else if (submitBtn.classList.contains('h-3-btn')) {
                    submitBtn.textContent = '문의하기';
                } else if (submitBtn.classList.contains('h-9-btn')) {
                    submitBtn.innerHTML = '<img src="images/h-9/h-9-btn.png" alt="문의하기">';
                } else {
                    submitBtn.textContent = '문의하기';
                }
            }
        });
    });
}

// 부드러운 스크롤
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
}

// 스크롤 시 헤더 스타일 변경
function initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) return;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 100) {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        } else {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        }
    });
}

// 미니 상담폼
function initMiniConsultation() {
    const miniToggle = document.getElementById('miniToggle');
    const miniConsultation = document.getElementById('miniConsultation');
    const miniForm = document.querySelector('.mini-form');
    const miniViewButtons = document.querySelectorAll('.mini-view-btn');
    const modals = {
        privacy: document.getElementById('privacyModal'),
        marketing: document.getElementById('marketingModal')
    };
    
    if (miniToggle && miniConsultation) {
        miniToggle.addEventListener('click', () => {
            miniConsultation.style.display = 'none';
        });
    }
    
    if (miniForm) {
        miniForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const privacyCheckbox = miniForm.querySelector('input[type="checkbox"][required]');
            if (!privacyCheckbox || !privacyCheckbox.checked) {
                showAlert('개인정보처리방침 동의는 필수입니다.');
                return;
            }
            
            // 폼 데이터 가져오기
            const inputs = miniForm.querySelectorAll('input[type="text"], input[type="tel"]');
            const nameInput = Array.from(inputs).find(input => input.placeholder === '성함');
            const phoneInput = Array.from(inputs).find(input => input.placeholder === '연락처');
            const carInput = Array.from(inputs).find(input => input.placeholder === '차종');
            
            if (!nameInput || !phoneInput || !carInput) {
                showAlert('모든 필드를 입력해주세요.');
                return;
            }
            
            const name = nameInput.value.trim();
            const phone = phoneInput.value.trim();
            const carName = carInput.value.trim();
            
            // 기본 검증
            if (!name || !phone || !carName) {
                showAlert('모든 필드를 입력해주세요.');
                return;
            }
            
            if (name.length < 2) {
                showAlert('성함을 정확히 입력해주세요.');
                nameInput.focus();
                return;
            }
            
            if (carName.length < 2) {
                showAlert('차종을 정확히 입력해주세요.');
                carInput.focus();
                return;
            }
            
            // 버튼 비활성화
            const submitBtn = miniForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
            }
            
            // 로딩 오버레이 표시
            showLoadingOverlay('문의 접수 중입니다');
            
            // 문의 저장
            const success = await saveInquiry(name, phone, carName);
            
            // 로딩 오버레이 숨김
            hideLoadingOverlay();
            
            if (success) {
                miniForm.reset();
                // 완료 모달 표시
                showCompletionModal();
            }
            
            // 버튼 활성화
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '상담신청';
            }
        });
    }
    
    miniViewButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const modalType = button.getAttribute('data-modal');
            if (modals[modalType]) {
                modals[modalType].classList.add('active');
            }
        });
    });
}

// Top 버튼
function initTopButton() {
    const topBtn = document.getElementById('topBtn');
    if (!topBtn) return;
    
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            topBtn.classList.add('visible');
        } else {
            topBtn.classList.remove('visible');
        }
    });
    
    topBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// 모바일 상담신청 버튼
function initMobileConsultBtn() {
    const mobileConsultBtn = document.querySelector('.mobile-consult-btn');
    if (!mobileConsultBtn) return;
    
    mobileConsultBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const consultationSection = document.getElementById('consultation') || document.getElementById('consultation2');
        if (consultationSection) {
            consultationSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
}
