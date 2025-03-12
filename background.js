const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Ajusta o tamanho do canvas para cobrir toda a tela
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];
const maxParticles = 500; // Número de partículas (ajustado para bastante partículas)

class Particle {
    constructor(x, y, speedX, speedY, size, color) {
        this.x = x;
        this.y = y;
        this.speedX = speedX;
        this.speedY = speedY;
        this.size = size;
        this.color = color;
        this.opacity = Math.random() * 0.2 + 0.2; // Opacidade das partículas para efeito mais sutil
    }

    update() {
        // Atualiza a posição das partículas
        this.x += this.speedX;
        this.y += this.speedY;

        // Se a partícula sair da tela, ela será recolocada na parte oposta
        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
    }

    draw() {
        // Cor preta com opacidade para as partículas
        ctx.fillStyle = `rgba(0, 0, 0, ${this.opacity})`; 
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Função para gerar as partículas e ocupar toda a tela
function createParticles() {
    for (let i = 0; i < maxParticles; i++) {
        const size = Math.random() * 3 + 1; // Tamanho das partículas
        const speedX = (Math.random() - 0.5) * 0.5; // Movimento mais suave
        const speedY = (Math.random() - 0.5) * 0.5; // Movimento mais suave
        const color = 'rgba(0, 0, 0, 0.1)'; // Cor preta com menos opacidade para as partículas

        // Adiciona as partículas à tela em posições aleatórias
        particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height, speedX, speedY, size, color));
    }
}

// Função para desenhar os raios conectando as partículas
function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Desenha um raio entre as partículas se elas estiverem próximas
            if (distance < 40) { // Distância maior entre as partículas
                const opacity = 1 - distance / 150; // Opacidade da linha (raio)
                ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`; // Raios em preto
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

// Função para animar as partículas
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpa o canvas a cada quadro

    // Atualiza e desenha todas as partículas
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }

    // Desenha os raios conectando as partículas próximas
    drawConnections();

    requestAnimationFrame(animate); // Chama a função de animação novamente
}

// Função para afastar as partículas do mouse ou clique
function handleInteraction(e) {
    // Captura as coordenadas do evento (mouse/touch)
    const rect = canvas.getBoundingClientRect(); // Obtém a posição do canvas na tela
    const x = (e.clientX || e.touches[0].clientX) - rect.left; // Corrige a posição em relação ao canvas
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    for (let i = 0; i < particles.length; i++) {
        const dx = particles[i].x - x;
        const dy = particles[i].y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Distância entre o mouse e a partícula
        if (dist < 150) { // Afastamento maior, com 200px de distância de interação
            const angle = Math.atan2(dy, dx);
            const force = 10.0 / dist; // Aumenta a força de repulsão

            // Afasta a partícula
            particles[i].speedX += Math.cos(angle) * force;
            particles[i].speedY += Math.sin(angle) * force;
        }
    }
}

// Adiciona eventos para capturar movimentos do mouse ou toque
canvas.addEventListener('mousemove', handleInteraction); // Mouse
canvas.addEventListener('click', handleInteraction); // Clique do mouse
canvas.addEventListener('touchmove', handleInteraction); // Movimento de toque no celular
canvas.addEventListener('touchstart', handleInteraction); // Toque inicial na tela

// Inicializa as partículas em toda a tela
createParticles();

// Inicia a animação
animate();
