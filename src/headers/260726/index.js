const header = document.querySelector('header');

const style = document.createElement('style');
style.textContent = `
    header {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #f0f0f0;
    }
`;

document.head.appendChild(style);
header.innerHTML = "<h1>PLACEHOLDER</h1>";

