// 포토후기 전용: 20개씩 페이징 (PC 5x4, 모바일 2x10)
(function () {
    function formatReviewDate(createdAt) {
        if (!createdAt) return '';
        try {
            var d = new Date(createdAt);
            if (isNaN(d.getTime())) return '';
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            return y + '.' + m + '.' + day;
        } catch (_) { return ''; }
    }

    function getReviewMainImage(review) {
        if (review.images && Array.isArray(review.images) && review.images.length > 0) return review.images[0];
        return review.image_url || '';
    }

    function createReviewCard(review) {
        if (!review) return '';
        var mainImg = getReviewMainImage(review);
        var text = review.text_content ? review.text_content.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        var titleStr = review.title ? review.title.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        var rawTitle = titleStr || (text ? text : '고객 후기');
        var detailTitle = rawTitle.length > 7 ? rawTitle.slice(0, 7) + '…' : rawTitle;
        var dateStr = formatReviewDate(review.created_at);
        var detailUrl = 'photo-review-detail.html?id=' + encodeURIComponent(review.id);
        return '<a href="' + detailUrl + '" class="review-card-link">' +
            '<article class="review-card">' +
            '<div class="review-card-image-wrap">' +
            '<img src="' + mainImg + '" alt="고객후기 대표이미지" class="review-card-image" onerror="this.style.display=\'none\'">' +
            '</div>' +
            '<p class="review-card-click-msg">사진을 클릭하시면 상세내역을 보실 수 있습니다. 클릭♥</p>' +
            '<h3 class="review-card-title">' + detailTitle + '</h3>' +
            '<p class="review-card-meta">카플랫폼 ' + (dateStr ? '| ' + dateStr : '') + '</p>' +
            '<div class="review-card-product">' +
            '<span class="review-card-product-label">상품정보&gt;</span>' +
            '<div class="review-card-product-content">' + (text || '-') + '</div>' +
            '</div>' +
            '</article>' +
            '</a>';
    }

    var PER_PAGE = 20;
    var reviewList = [];
    var currentPage = 1;

    function renderPage() {
        var grid = document.getElementById('photoReviewGrid');
        var pagination = document.getElementById('photoReviewPagination');
        if (!grid) return;

        var start = (currentPage - 1) * PER_PAGE;
        var slice = reviewList.slice(start, start + PER_PAGE);
        grid.innerHTML = slice.map(createReviewCard).join('');

        var totalPages = Math.ceil(reviewList.length / PER_PAGE);
        if (!pagination || totalPages <= 1) return;
        pagination.innerHTML = '';
        for (var i = 1; i <= totalPages; i++) {
            var btn = document.createElement('button');
            btn.textContent = i;
            btn.classList.toggle('active', i === currentPage);
            btn.addEventListener('click', function () {
                currentPage = parseInt(this.textContent, 10);
                renderPage();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            pagination.appendChild(btn);
        }
    }

    async function init() {
        var grid = document.getElementById('photoReviewGrid');
        if (!grid) return;

        grid.innerHTML = '<p style="text-align:center; padding: 40px; color: #666;">로딩 중...</p>';
        try {
            var response = await fetch('/api/reviews?active=true');
            var data = await response.json();
            if (!data.success || !data.reviews || data.reviews.length === 0) {
                grid.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">등록된 포토후기가 없습니다.</p>';
                return;
            }
            reviewList = data.reviews;
            currentPage = 1;
            renderPage();
        } catch (err) {
            console.error(err);
            grid.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">포토후기를 불러오는데 실패했습니다.</p>';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
