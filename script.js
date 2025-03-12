let currentIndex = 0;

function moveSlide(direction) {
    const carousel = document.querySelector('.carousel');
    const images = document.querySelectorAll('.carousel img');
    const totalImages = images.length;

    currentIndex += direction;

    if (currentIndex < 0) {
        currentIndex = totalImages - 1; // Vai para a última imagem
    } else if (currentIndex >= totalImages) {
        currentIndex = 0; // Vai para a primeira imagem
    }

    const offset = -currentIndex * 33.333; // Ajuste para mostrar uma imagem de cada vez
    carousel.style.transform = `translateX(${offset}%)`;
}

// Muda a imagem automaticamente a cada 3 segundos
setInterval(() => moveSlide(1), 5000);
