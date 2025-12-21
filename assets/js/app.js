// Main App Logic - Navigation and Initialization

const navLinks = document.querySelectorAll('.nav-links a');
const pages = document.querySelectorAll('.page');
const homeImage = document.querySelector('.home-image');
const hamburgerBtn = document.getElementById('hamburger-menu');
const navLinksContainer = document.getElementById('nav-links');

function showPage(id) {
    pages.forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(id).classList.add('active');

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
        }
    });

    // Fechar menu ao clicar em um link
    if (hamburgerBtn.classList.contains('active')) {
        hamburgerBtn.classList.remove('active');
        navLinksContainer.classList.remove('active');
    }
}

function handleHashChange() {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        showPage(hash);
    } else {
        showPage('home');
    }
}

// Hamburger Menu Toggle
if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.toggle('active');
        navLinksContainer.classList.toggle('active');
    });
}

// Event Listeners
window.addEventListener('load', () => {
    homeImage.src = 'assets/images/violao.svg';
    handleHashChange();
    initNotasSection();
});

window.addEventListener('hashchange', handleHashChange);

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = link.getAttribute('href');
    });
});
