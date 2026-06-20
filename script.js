window.PhotoMode = {
  state: {
    rotation: -13,
    lightX: 32,
    lightY: 32,
    contrast: 1.12,
    brightness: 0.58
  },

  toggle() {
    const ui = document.getElementById('photo-mode-ui');

    if (!ui) return;

    ui.style.display = ui.style.display === 'block' ? 'none' : 'block';
  },

  apply() {
    const root = document.documentElement;

    root.style.setProperty('--planet-rot', `${this.state.rotation}deg`);
    root.style.setProperty('--light-pos-x', `${this.state.lightX}%`);
    root.style.setProperty('--light-pos-y', `${this.state.lightY}%`);
    root.style.setProperty('--pm-contrast', this.state.contrast);
    root.style.setProperty('--pm-brightness', this.state.brightness);
  },

  bindSlider(id, key, formatter = Number) {
    const slider = document.getElementById(id);

    if (!slider) return;

    slider.addEventListener('input', (event) => {
      this.state[key] = formatter(event.target.value);
      this.apply();
    });
  },

  init() {
    this.bindSlider('slider-rotation', 'rotation', Number);
    this.bindSlider('slider-light-x', 'lightX', Number);
    this.bindSlider('slider-light-y', 'lightY', Number);
    this.bindSlider('slider-contrast', 'contrast', Number);
    this.bindSlider('slider-brightness', 'brightness', Number);

    this.apply();

    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'p') {
        this.toggle();
      }
    });
  },

  async takeScreenshot() {
    const ui = document.getElementById('photo-mode-ui');
    const stage = document.getElementById('capture-stage');

    if (!stage) {
      alert('Elemento de captura não encontrado.');
      return;
    }

    if (typeof html2canvas === 'undefined') {
      alert('A biblioteca html2canvas não foi carregada.');
      return;
    }

    const previousDisplay = ui ? ui.style.display : '';

    if (ui) {
      ui.style.display = 'none';
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      const canvas = await html2canvas(stage, {
        backgroundColor: '#000000',
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: stage.offsetWidth,
        height: stage.offsetHeight
      });

      const link = document.createElement('a');
      link.download = 'Isomium_Capture.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error(error);
      alert('Não foi possível capturar a imagem.');
    } finally {
      if (ui) {
        ui.style.display = previousDisplay || 'block';
      }
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  window.PhotoMode.init();
});
