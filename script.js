// 현재 단계 추적
let currentStep = 1;
const totalSteps = 6;

// 이미지 순차 무한 반복 재생 (5초 간격)
let gif1 = document.getElementById('gif1');
let gif2 = document.getElementById('gif2');
let img3 = document.getElementById('img3');
let currentIndex = 0;
const images = [];
const slideDuration = 5000; // 5초

function initImages() {
    // 이미지 요소 확인
    if (!gif1 || !gif2 || !img3) {
        console.error('이미지 요소를 찾을 수 없습니다.');
        // 재시도
        setTimeout(initImages, 200);
        return;
    }
    
    images[0] = gif1;
    images[1] = gif2;
    images[2] = img3;
    
    // 모든 이미지를 항상 로드하고 표시하도록 설정 (GIF 무한 재생을 위해)
    images.forEach((img, index) => {
        // 이미지가 항상 DOM에 존재하도록 보장
        img.style.display = 'block';
        img.style.position = 'absolute';
        
        // GIF의 경우 재생을 위해 항상 로드되도록 강제
        if (img.src && img.src.includes('.gif')) {
            // GIF 재생을 위해 src를 다시 설정하여 재생 강제
            const originalSrc = img.src;
            img.src = '';
            setTimeout(() => {
                img.src = originalSrc;
            }, 50);
        }
    });
    
    // 첫 번째 이미지 즉시 표시
    showImage(0);
    
    // 5초마다 다음 이미지로 전환
    setInterval(() => {
        currentIndex = (currentIndex + 1) % images.length;
        showImage(currentIndex);
    }, slideDuration);
}

function showImage(index) {
    images.forEach((img, i) => {
        if (i === index) {
            img.classList.add('active');
            img.style.opacity = '1';
            img.style.visibility = 'visible';
            img.style.zIndex = '10';
        } else {
            img.classList.remove('active');
            img.style.opacity = '0';
            img.style.visibility = 'hidden';
            img.style.zIndex = '1';
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
        case 6:
            document.getElementById('user_time')?.classList.remove('error');
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
        alert('소속 구분을 선택해주세요.');
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
        alert('차량 유형을 선택해주세요.');
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
        alert('차량명을 입력해주세요.');
        carNameInput.focus();
        return false;
    }
    if (carName.length < 2) {
        carNameInput.classList.add('error');
        alert('차량명을 정확히 입력해주세요.');
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
        alert('성함을 입력해주세요.');
        userNameInput.focus();
        return false;
    }
    
    if (!userPhone) {
        userPhoneInput.classList.add('error');
        alert('연락처를 입력해주세요.');
        userPhoneInput.focus();
        return false;
    }
    
    // 연락처 형식 검증 (숫자만, 10-11자리)
    const phonePattern = /^[0-9]{10,11}$/;
    const phoneNumber = userPhone.replace(/[^0-9]/g, '');
    if (!phonePattern.test(phoneNumber)) {
        userPhoneInput.classList.add('error');
        alert('올바른 연락처를 입력해주세요. (숫자만 입력, 10-11자리)');
        userPhoneInput.focus();
        return false;
    }
    
    if (!privacyAgree) {
        alert('개인정보 수집 및 이용에 동의해주세요.');
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
        alert('통화 가능시간을 입력해주세요.');
        callTimeInput.focus();
        return false;
    }
    if (callTime.length < 3) {
        callTimeInput.classList.add('error');
        alert('통화 가능시간을 정확히 입력해주세요.');
        callTimeInput.focus();
        return false;
    }
    return true;
}

// 다음 단계로 이동 (Validation 포함)
function nextButton() {
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
        case 6:
            // STEP 06은 validation 체크하지 않음
            isValid = true;
            break;
    }
    
    // Validation 실패 시 다음 단계로 이동하지 않음
    if (!isValid) {
        return false;
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
    } else {
        // 완료 페이지
        const applySection = document.querySelector('.apply-inner');
        if (applySection) {
            applySection.classList.add('active');
        }
    }
    
    return true;
}

// 개인정보처리방침 모달
function closePrivacyModal() {
    document.getElementById('privacyModal').classList.add('hidden');
}
