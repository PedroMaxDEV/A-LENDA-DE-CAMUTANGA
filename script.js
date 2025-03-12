let currentIndex = 0;
const slides = document.querySelectorAll(".slide");
const totalSlides = slides.length;
const carousel = document.querySelector(".carousel");

// Obtém dinamicamente a largura do slide
function updateSlide() {
    const slideWidth = document.querySelector(".carousel-container").offsetWidth;
    carousel.style.transform = `translateX(${-currentIndex * slideWidth}px)`;
}

// Muda o slide
function moveSlide(step) {
    currentIndex = (currentIndex + step + totalSlides) % totalSlides;
    updateSlide();
}

// Passagem automática a cada 4 segundos
function autoSlide() {
    moveSlide(1);
}

// Iniciar a rotação automática
let slideInterval = setInterval(autoSlide, 4000);

// Pausar quando o mouse estiver sobre o carrossel
document.querySelector(".carousel-container").addEventListener("mouseenter", () => {
    clearInterval(slideInterval);
});

// Retomar quando o mouse sair do carrossel
document.querySelector(".carousel-container").addEventListener("mouseleave", () => {
    slideInterval = setInterval(autoSlide, 4000);
});

// Ajustar slides quando a tela for redimensionada
window.addEventListener("resize", updateSlide);
