(function () {
    function getParam(name) {
        var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
        return m ? decodeURIComponent(m[1]) : '';
    }

    function show(el, show) {
        if (!el) return;
        el.classList.toggle('hidden', !show);
    }

    async function init() {
        var id = getParam('id');
        var loading = document.getElementById('detailLoading');
        var error = document.getElementById('detailError');
        var content = document.getElementById('detailContent');
        var detailImages = document.getElementById('detailImages');
        var detailTitle = document.getElementById('detailTitle');
        var detailDescription = document.getElementById('detailDescription');
        var detailDownloadList = document.getElementById('detailDownloadList');

        if (!id) {
            show(loading, false);
            show(error, true);
            return;
        }

        try {
            var res = await fetch('/api/reviews?id=' + encodeURIComponent(id));
            var data = await res.json();
            show(loading, false);
            if (!data.success || !data.review) {
                show(error, true);
                return;
            }
            var r = data.review;
            var images = r.images && Array.isArray(r.images) && r.images.length > 0 ? r.images : (r.image_url ? [r.image_url] : []);

            detailImages.innerHTML = images.map(function (url, i) {
                return '<div class="detail-image-item"><img src="' + url + '" alt="후기 이미지 ' + (i + 1) + '" onerror="this.style.display=\'none\'"></div>';
            }).join('');

            detailTitle.textContent = r.title || '제목 없음';
            detailDescription.textContent = r.text_content || '';
            detailDescription.style.whiteSpace = 'pre-wrap';

            if (images.length > 0) {
                detailDownloadList.innerHTML = images.map(function (url, i) {
                    var num = i + 1;
                    return '<li><a href="' + url + '" download="review-image-' + num + '.jpg" target="_blank" rel="noopener">이미지 ' + num + ' 다운로드</a></li>';
                }).join('');
            } else {
                document.getElementById('detailDownloads').style.display = 'none';
            }

            show(content, true);
        } catch (e) {
            console.error(e);
            show(loading, false);
            show(error, true);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
