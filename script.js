let currentIndex = 0;

function updateCarouselSize() {
    const carouselContainer = document.querySelector('.carousel-container');
    const images = document.querySelectorAll('.carousel img');

    if (images.length > 0) {
        const currentImage = images[currentIndex];
        carouselContainer.style.height = `${currentImage.clientHeight}px`; // Ajusta a altura dinamicamente
    }
}

function moveSlide(direction) {
    const carousel = document.querySelector('.carousel');
    const images = document.querySelectorAll('.carousel img');
    const totalImages = images.length;

    currentIndex += direction;

    if (currentIndex < 0) {
        currentIndex = totalImages - 1;
    } else if (currentIndex >= totalImages) {
        currentIndex = 0;
    }

    const offset = -currentIndex * 100;
    carousel.style.transform = `translateX(${offset}%)`;

    updateCarouselSize(); // Atualiza o tamanho do contêiner ao trocar de imagem
}

// Ajusta o tamanho do carrossel quando a página carrega
window.onload = updateCarouselSize;

// Muda a imagem automaticamente a cada 3 segundos
setInterval(() => moveSlide(1), 3000);
