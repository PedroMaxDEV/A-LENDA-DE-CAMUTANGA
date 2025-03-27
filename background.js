const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Ajusta o tamanho do canvas para cobrir toda a tela
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];
const maxParticles = (canvas.width * canvas.height) / 10000; // Partículas ajustadas ao tamanho da tela

// Classe das partículas
class Particle {
    constructor(x, y, speedX, speedY, size, color) {
        this.x = x;
        this.y = y;
        this.speedX = speedX;
        this.speedY = speedY;
        this.size = size;
        this.color = color;
        this.opacity = Math.random() * 0.2 + 0.3; // Opacidade variável para dar um ar mais sutil
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
        // Desenha a partícula com o brilho azul
        ctx.fillStyle = `rgba(0, 255, 255, ${this.opacity})`; // Azul neon
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Função para gerar as partículas
function createParticles() {
    for (let i = 0; i < maxParticles; i++) {
        const size = Math.random() * 2 + 1; // Tamanho das partículas
        const speedX = (Math.random() - 0.5) * 0.5; // Movimento suave
        const speedY = (Math.random() - 0.5) * 0.5; // Movimento suave
        const color = 'rgba(0, 255, 255, 0.1)'; // Cor azul claro com opacidade ajustada

        // Adiciona as partículas com posições aleatórias
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
            if (distance < 80) { // Distância maior para mostrar os raios
                const opacity = 1 - distance / 150; // Opacidade da linha (raio)
                ctx.strokeStyle = `rgba(0, 255, 255, ${opacity})`; // Raios com cor azul neon
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
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    for (let i = 0; i < particles.length; i++) {
        const dx = particles[i].x - x;
        const dy = particles[i].y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
            const angle = Math.atan2(dy, dx);
            const force = 9.0 / dist; // Aumenta a força de repulsão

            particles[i].speedX += Math.cos(angle) * force;
            particles[i].speedY += Math.sin(angle) * force;
        }
    }
}

// Adiciona eventos para capturar movimentos do mouse ou toque
canvas.addEventListener('mousemove', handleInteraction); // Mouse
canvas.addEventListener('click', handleInteraction); // Clique
canvas.addEventListener('touchmove', handleInteraction); // Toque
canvas.addEventListener('touchstart', handleInteraction); // Toque inicial

// Inicializa as partículas
createParticles();

// Inicia a animação
animate();
