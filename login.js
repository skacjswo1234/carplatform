// API 기본 URL
const API_BASE_URL = '/api';

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.getElementById('loginMessage');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const password = document.getElementById('password').value;
        const loginBtn = document.querySelector('.login-btn');
        
        if (!password) {
            showMessage('비밀번호를 입력해주세요.', 'error');
            return;
        }

        // 로딩 상태
        loginBtn.disabled = true;
        loginBtn.textContent = '로그인 중...';
        messageDiv.textContent = '';
        messageDiv.className = 'login-message';

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: password }),
            });

            const result = await response.json();

            if (result.success) {
                // 로그인 성공 - localStorage에 로그인 상태 저장
                localStorage.setItem('admin_logged_in', 'true');
                
                // 관리자 페이지로 이동
                window.location.href = 'admin.html';
            } else {
                // 로그인 실패
                showMessage(result.error || '비밀번호가 올바르지 않습니다.', 'error');
                loginBtn.disabled = false;
                loginBtn.textContent = '로그인';
            }
        } catch (error) {
            console.error('Error during login:', error);
            showMessage('로그인 중 오류가 발생했습니다.', 'error');
            loginBtn.disabled = false;
            loginBtn.textContent = '로그인';
        }
    });
});

function showMessage(message, type) {
    const messageDiv = document.getElementById('loginMessage');
    messageDiv.textContent = message;
    messageDiv.className = `login-message ${type}`;
}
