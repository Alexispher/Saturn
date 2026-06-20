// photo-mode.js
const PhotoMode = {
    state: {
        lightX: 30,      // Posição X da luz (sol)
        lightY: 30,      // Posição Y da luz
        rotation: -13,   // Rotação do planeta
        contrast: 1.12,  // Contraste da foto
        brightness: 0.58 // Brilho
    },

    init() {
        this.root = document.documentElement;
        this.updateScene();
        this.bindControls();
    },

    updateScene() {
        // Atualiza as variáveis CSS em tempo real
        this.root.style.setProperty('--light-pos-x', `${this.state.lightX}%`);
        this.root.style.setProperty('--light-pos-y', `${this.state.lightY}%`);
        this.root.style.setProperty('--planet-rot', `${this.state.rotation}deg`);
        this.root.style.setProperty('--pm-contrast', this.state.contrast);
        this.root.style.setProperty('--pm-brightness', this.state.brightness);
    },

    bindControls() {
        // Exemplo: Conectando o slider de Rotação da UI
        document.getElementById('slider-rotation').addEventListener('input', (e) => {
            this.state.rotation = e.target.value;
            this.updateScene();
        });

        // Conectando o movimento da Luz (Eixo X)
        document.getElementById('slider-light-x').addEventListener('input', (e) => {
            this.state.lightX = e.target.value;
            this.updateScene();
        });
        
        // Adicione os outros sliders seguindo essa mesma lógica...
    },

    // Função para tirar a print em alta qualidade
    takeScreenshot() {
        // Oculta a UI do Modo Foto
        document.getElementById('photo-mode-ui').style.display = 'none';
        
        // Aqui você pode usar uma biblioteca como html2canvas
        html2canvas(document.querySelector("#saturn")).then(canvas => {
            const link = document.createElement('a');
            link.download = 'PEGASUS_Saturn_Capture.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            // Restaura a UI
            document.getElementById('photo-mode-ui').style.display = 'flex';
        });
    }
};

window.onload = () => PhotoMode.init();
