const showError = document.getElementById('showError')
const users = JSON.parse(localStorage.getItem('users')) || []

if (localStorage.getItem('currentUser')) window.location.href = 'keep.html'

const signIn = () => {
    const mail = document.getElementById('email').value.trim()
    const pass = document.getElementById('password').value
    const user = users.find(u => u.mail === mail && u.pass === pass)
    if (!user) {
        showError.innerHTML = `<p class="alert alert-danger text-center fw-bold py-2">Invalid email or password!</p>`
        setTimeout(() => { showError.innerHTML = '' }, 2000)
        return
    }
    localStorage.setItem('currentUser', JSON.stringify({ fName: user.fName, lName: user.lName, mail: user.mail }))
    window.location.href = 'keep.html'
}

window.addEventListener('keypress', e => { if (e.key === 'Enter') signIn() })
