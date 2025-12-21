// Main App Logic - Navigation and Initialization

const navLinks = document.querySelectorAll('.nav-links a');
const pages = document.querySelectorAll('.page');
const homeImage = document.querySelector('.home-image');

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
}

function handleHashChange() {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        showPage(hash);
    } else {
        showPage('home');
    }
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
