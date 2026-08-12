window.addEventListener('keypress', (e) => {
    // console.log(e);
    if (e.key == 'Enter') {
        // console.log('enter ooo');
        signUp()
    }
})

const allUsers = [];

const signUp = () => {
    const fName = document.getElementById('firstName').value
    const lName = document.getElementById('lastName').value
    const mail = document.getElementById('email').value
    const pass = document.getElementById('password').value

    // console.log(fName, lName, mail, pass);
    const user = { fName, lName, mail, pass }
    if (fName.trim() == '' || lName.trim() == '' || mail.trim() == '' || pass.trim() == '') {
        // console.error('empty inputs');
        showError.innerHTML = `<p class="alert alert-danger text-center fw-bold py-2">All fields are required!</p>`

        setTimeout(() => {
            showError.innerHTML = ''
        }, 2000)
    } else {
        // console.log(user);
        allUsers.push(user);
        console.log(allUsers);
        displayUsers()
    }
}

function displayUsers() {
    show.innerHTML = ''
    for (let index = 0; index < allUsers.length; index++) {
        const element = allUsers[index];
        show.innerHTML += `
            <div class="card text-left my-lg-4 my-2">
                <div class="card-body">
                    <h4 class="card-title">${index + 1}</h4>
                    <p class="card-text">
                        <h3>${element.fName} ${element.lName}</h3>
                        <p>${element.mail}</p>
                    </p>
                </div>
            </div>
        `
    }
}