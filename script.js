// 현재 단계 추적
let currentStep = 1;
const totalSteps = 5;

function showLoadingOverlay(message = 'AI 견적 비교 중') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;

    const textEl = document.getElementById('loadingText');
    if (textEl) textEl.textContent = message;

    overlay.classList.remove('hidden');
    document.body.classList.add('is-loading');
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;

    overlay.classList.add('hidden');
    document.body.classList.remove('is-loading');
}

function setStep5SubmitDisabled(disabled) {
    const btn = document.querySelector('.step05-inner .cta-btn');
    if (!btn) return;

    btn.classList.toggle('is-disabled', disabled);
    btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
}

// 이미지/비디오 순차 재생 (비디오는 끝까지 재생 후 다음으로 전환)
let gif1 = document.getElementById('gif1');
let gif2 = document.getElementById('gif2');
let img3 = document.getElementById('img3');
let currentIndex = 0;
const images = [];
let imageTimeout = null; // h-3.jpg 표시 타이머

function initImages() {
    // 이미지/비디오 요소 확인
    if (!gif1 || !gif2 || !img3) {
        console.error('이미지/비디오 요소를 찾을 수 없습니다.');
        // 재시도
        setTimeout(initImages, 200);
        return;
    }
    
    images[0] = gif1;
    images[1] = gif2;
    images[2] = img3;
    
    // 모든 이미지/비디오를 항상 로드하고 표시하도록 설정
    images.forEach((media, index) => {
        // 요소가 항상 DOM에 존재하도록 보장
        media.style.display = 'block';
        media.style.position = 'absolute';
        
        // 비디오의 경우 ended 이벤트 리스너 추가
        if (media.tagName === 'VIDEO') {
            media.addEventListener('ended', function() {
                // 비디오가 끝나면 다음으로 전환
                nextMedia();
            });
            
            // 비디오 로드
            media.load();
        }
    });
    
    // 첫 번째 비디오 즉시 표시 및 재생
    showImage(0);
}

// 다음 미디어로 전환
function nextMedia() {
    // 현재 타이머가 있으면 클리어
    if (imageTimeout) {
        clearTimeout(imageTimeout);
        imageTimeout = null;
    }
    
    // 다음 인덱스로 이동
    currentIndex = (currentIndex + 1) % images.length;
    
    const nextMedia = images[currentIndex];
    
    // 다음 미디어 표시
    showImage(currentIndex);
    
    // 이미지인 경우 (h-3.jpg) 일정 시간 후 다시 첫 번째 비디오로
    if (nextMedia.tagName === 'IMG') {
        imageTimeout = setTimeout(() => {
            currentIndex = 0;
            showImage(0);
        }, 3000); // 3초 후 다시 h-1.mp4로
    }
}

function showImage(index) {
    images.forEach((media, i) => {
        if (i === index) {
            media.classList.add('active');
            media.style.opacity = '1';
            media.style.visibility = 'visible';
            media.style.zIndex = '10';
            // 비디오인 경우 처음부터 재생
            if (media.tagName === 'VIDEO') {
                media.currentTime = 0; // 처음부터 재생
                media.play().catch(e => {
                    console.log('비디오 재생 실패:', e);
                });
            }
        } else {
            media.classList.remove('active');
            media.style.opacity = '0';
            media.style.visibility = 'hidden';
            media.style.zIndex = '1';
            // 비디오인 경우 일시정지 및 처음으로 리셋
            if (media.tagName === 'VIDEO') {
                media.pause();
                media.currentTime = 0;
            }
        }
    });
    updatePagination(index);
}

// 페이지네이션 업데이트
function updatePagination(index) {
    const bullets = document.querySelectorAll('.swiper-pagination-bullet');
    bullets.forEach((bullet, i) => {
        if (i === index) {
            bullet.classList.add('swiper-pagination-bullet-active');
        } else {
            bullet.classList.remove('swiper-pagination-bullet-active');
        }
    });
}

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 이미지 초기화
    setTimeout(() => {
        initImages();
    }, 100);
    
    // 개인정보 전문보기 클릭 이벤트
    const privacyBtn = document.querySelector('.pop-privacy');
    if (privacyBtn) {
        privacyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('privacyModal').classList.remove('hidden');
        });
    }
    
    // 모달 외부 클릭 시 닫기
    const privacyModal = document.getElementById('privacyModal');
    if (privacyModal) {
        privacyModal.addEventListener('click', function(e) {
            if (e.target === privacyModal) {
                closePrivacyModal();
            }
        });
    }
    
    // Alert 모달 외부 클릭 시 닫기
    const alertModal = document.getElementById('alertModal');
    if (alertModal) {
        alertModal.addEventListener('click', function(e) {
            if (e.target === alertModal) {
                closeAlertModal();
            }
        });
    }
});

// 에러 상태 제거 함수
function removeErrorState(step) {
    switch(step) {
        case 2:
            document.querySelectorAll('input[name="wr_7"] + label').forEach(label => {
                label.classList.remove('error');
            });
            break;
        case 3:
            document.querySelectorAll('input[name="wr_3"] + label').forEach(label => {
                label.classList.remove('error');
            });
            break;
        case 4:
            document.getElementById('user_car')?.classList.remove('error');
            break;
        case 5:
            document.getElementById('user_name')?.classList.remove('error');
            document.getElementById('user_phone')?.classList.remove('error');
            break;
    }
}

// Validation 함수들
function validateStep02() {
    removeErrorState(2);
    const selected = document.querySelector('input[name="wr_7"]:checked');
    if (!selected) {
        document.querySelectorAll('input[name="wr_7"] + label').forEach(label => {
            label.classList.add('error');
        });
        showAlertModal('소속 구분을 선택해주세요.');
        return false;
    }
    return true;
}

function validateStep03() {
    removeErrorState(3);
    const selected = document.querySelector('input[name="wr_3"]:checked');
    if (!selected) {
        document.querySelectorAll('input[name="wr_3"] + label').forEach(label => {
            label.classList.add('error');
        });
        showAlertModal('차량 유형을 선택해주세요.');
        return false;
    }
    return true;
}

function validateStep04() {
    removeErrorState(4);
    const carNameInput = document.getElementById('user_car');
    const carName = carNameInput.value.trim();
    
    if (!carName) {
        carNameInput.classList.add('error');
        showAlertModal('차량명을 입력해주세요.');
        carNameInput.focus();
        return false;
    }
    if (carName.length < 2) {
        carNameInput.classList.add('error');
        showAlertModal('차량명을 정확히 입력해주세요.');
        carNameInput.focus();
        return false;
    }
    return true;
}

function validateStep05() {
    removeErrorState(5);
    const userNameInput = document.getElementById('user_name');
    const userPhoneInput = document.getElementById('user_phone');
    const userName = userNameInput.value.trim();
    const userPhone = userPhoneInput.value.trim();
    const privacyAgree = document.getElementById('c_privacy').checked;
    
    if (!userName) {
        userNameInput.classList.add('error');
        showAlertModal('성함을 입력해주세요.');
        userNameInput.focus();
        return false;
    }
    
    if (!userPhone) {
        userPhoneInput.classList.add('error');
        showAlertModal('연락처를 입력해주세요.');
        userPhoneInput.focus();
        return false;
    }
    
    // 연락처 형식 검증 (숫자만, 10-11자리)
    const phonePattern = /^[0-9]{10,11}$/;
    const phoneNumber = userPhone.replace(/[^0-9]/g, '');
    if (!phonePattern.test(phoneNumber)) {
        userPhoneInput.classList.add('error');
        showAlertModal('올바른 연락처를 입력해주세요.\n(숫자만 입력, 10-11자리)');
        userPhoneInput.focus();
        return false;
    }
    
    if (!privacyAgree) {
        showAlertModal('개인정보 수집 및 이용에 동의해주세요.');
        document.getElementById('c_privacy').focus();
        return false;
    }
    
    return true;
}

function validateStep06() {
    removeErrorState(6);
    const callTimeInput = document.getElementById('user_time');
    const callTime = callTimeInput.value.trim();
    
    if (!callTime) {
        callTimeInput.classList.add('error');
        showAlertModal('통화 가능시간을 입력해주세요.');
        callTimeInput.focus();
        return false;
    }
    if (callTime.length < 3) {
        callTimeInput.classList.add('error');
        showAlertModal('통화 가능시간을 정확히 입력해주세요.');
        callTimeInput.focus();
        return false;
    }
    return true;
}

// 다음 단계로 이동 (Validation 포함)
async function nextButton() {
    let isValid = true;
    
    // 현재 단계별 validation 체크
    switch(currentStep) {
        case 1:
            // STEP 01은 버튼만 있으므로 validation 불필요
            isValid = true;
            break;
        case 2:
            isValid = validateStep02();
            break;
        case 3:
            isValid = validateStep03();
            break;
        case 4:
            isValid = validateStep04();
            break;
        case 5:
            isValid = validateStep05();
            break;
    }
    
    // Validation 실패 시 다음 단계로 이동하지 않음
    if (!isValid) {
        return false;
    }
    
    // Step 5인 경우 데이터 저장 후 완료 모달 표시
    if (currentStep === 5) {
        setStep5SubmitDisabled(true);
        showLoadingOverlay('AI 견적 비교 중');

        try {
            // 데이터 저장
            await saveInquiry();
        } finally {
            hideLoadingOverlay();
            setStep5SubmitDisabled(false);
        }

        // 완료 모달 표시
        showCompletionModal();

        return true;
    }
    
    // Validation 통과 시 다음 단계로 이동
    const currentSection = document.querySelector(`.step0${currentStep}-wrap, .step0${currentStep}-inner`);
    if (currentSection) {
        currentSection.classList.remove('active');
    }
    
    // 진행 표시 업데이트
    const progressItems = document.querySelectorAll('.progress li');
    if (progressItems[currentStep - 1]) {
        progressItems[currentStep - 1].classList.remove('act_research');
    }
    
    currentStep++;
    
    if (currentStep <= totalSteps) {
        const nextSection = document.querySelector(`.step0${currentStep}-wrap, .step0${currentStep}-inner`);
        if (nextSection) {
            nextSection.classList.add('active');
        }
        
        if (progressItems[currentStep - 1]) {
            progressItems[currentStep - 1].classList.add('act_research');
        }
    }
    
    return true;
}

// Apps Script 웹앱 URL (직접 호출)
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw6eG32DIJ_yjjhNJTh9UQDP8nk1cF2QFrZZulq6WDLS9doMO9dfR6uB7IryhZwBZ9Y/exec';

async function sendInquiryToAppsScript(formData) {
    if (!APPS_SCRIPT_WEB_APP_URL) return;

    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        params.append(key, String(value));
    });

    // Apps Script는 CORS 응답이 없으므로 no-cors + form 방식으로 전송
    await fetch(APPS_SCRIPT_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: params,
    });
}

// 문의 데이터 저장
async function saveInquiry() {
    const formData = {
        name: document.getElementById('user_name').value.trim(),
        phone: document.getElementById('user_phone').value.replace(/[^0-9]/g, ''),
        affiliation: document.querySelector('input[name="wr_7"]:checked')?.value || null,
        vehicle_type: document.querySelector('input[name="wr_3"]:checked')?.value || null,
        car_name: document.getElementById('user_car').value.trim() || null
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
            throw new Error('데이터 저장에 실패했습니다.');
        }

        const result = await response.json();
        if (result.success) {
            console.log('문의가 성공적으로 저장되었습니다.');
        }
    } catch (error) {
        console.error('Error saving inquiry:', error);
        // 저장 실패해도 완료 페이지는 보여줌
    }

    // Apps Script로 전송 (메일 + 시트 기록)
    try {
        await sendInquiryToAppsScript(formData);
    } catch (error) {
        console.warn('Apps Script 전송 오류:', error);
    }
}

// 개인정보처리방침 모달
function closePrivacyModal() {
    document.getElementById('privacyModal').classList.add('hidden');
}

// Alert 모달
function showAlertModal(message) {
    const modal = document.getElementById('alertModal');
    const messageElement = document.getElementById('alertMessage');
    if (messageElement) {
        messageElement.textContent = message;
    }
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeAlertModal() {
    const modal = document.getElementById('alertModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 완료 모달 표시
let redirectTimer = null;
let countdownSeconds = 5;

function showCompletionModal() {
    const modal = document.getElementById('completionModal');
    const countdownElement = document.getElementById('completionCountdown');
    
    if (!modal) return;
    
    // 모달 표시
    modal.classList.remove('hidden');
    
    // 카운트다운 시작
    countdownSeconds = 5;
    updateCountdown(countdownElement);
    
    redirectTimer = setInterval(() => {
        countdownSeconds--;
        updateCountdown(countdownElement);
        
        if (countdownSeconds <= 0) {
            clearInterval(redirectTimer);
            redirectToMainSite();
        }
    }, 1000);
}

function updateCountdown(element) {
    if (element && countdownSeconds > 0) {
        element.textContent = `${countdownSeconds}초 후 자동으로 이동합니다.`;
    } else if (element && countdownSeconds <= 0) {
        element.textContent = '이동 중...';
    }
}

// 메인 사이트로 리다이렉트
function redirectToMainSite() {
    if (redirectTimer) {
        clearInterval(redirectTimer);
        redirectTimer = null;
    }
    
    // 새 창에서 열기 또는 현재 창에서 이동
    window.location.href = 'https://carplatform1.cafe24.com/';
}
