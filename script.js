let currentIndex = 0;
const slides = document.querySelectorAll('.carousel .slide');
const video = document.getElementById('papagaioVideo');

function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.style.display = i === index ? 'flex' : 'none';
    });
}

function moveSlide(step) {
    currentIndex += step;

    if (currentIndex >= slides.length) {
        currentIndex = 0; // Volta ao primeiro slide
    } else if (currentIndex < 0) {
        currentIndex = slides.length - 1; // Vai para o último slide
    }

    showSlide(currentIndex);

    // Se for o vídeo, exibe por 5 segundos e depois avança
    if (currentIndex === 10 && video) {
        video.play();
        setTimeout(() => moveSlide(1), 10000); // 10 segundos
    }
}

// Troca automática de slides (exceto o vídeo)
setInterval(() => {
    if (currentIndex !== 10) {
        moveSlide(1);
    }
}, 6000);

showSlide(currentIndex);

