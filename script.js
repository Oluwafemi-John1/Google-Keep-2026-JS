window.addEventListener('keypress', (e) => {
    // console.log(e);
    if (e.key == 'Enter') {
        // console.log('enter ooo');
        signUp()
    }
})
const allUsers = JSON.parse(localStorage.getItem('users')) || [];
// displayUsers()
// let gottenUsers = JSON.parse(localStorage.getItem('users'));
// console.log(gottenUsers);

// if(gottenUsers) {
//     allUsers = gottenUsers
// } else {
//     allUsers = []
// }


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
        const found = allUsers.find(eniyan => eniyan.mail === user.mail)
        // console.log(found);
        if (found) {
            // alert('user already exists')
            showError.innerHTML = `<p class="alert alert-danger text-center fw-bold py-2">user already exists!</p>`
            setTimeout(() => {
                showError.innerHTML = ''
            }, 2000)
        } else {
            allUsers.push(user);
            // console.log(allUsers);

            localStorage.setItem('users', JSON.stringify(allUsers))
            // displayUsers()
            buttona.innerHTML = `
                <button class="btn btn-dark w-100 border-0" type="button" disabled>
                    <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                    <span role="status">Loading...</span>
                </button>
            `
            setTimeout(() => {
                window.location.href = 'signin.html'
            }, 1500);
        }
    }
}

const deleteUser = (i) => {
    const confirmDelete = confirm('Are you sure you want to delete?')
    if (confirmDelete) {
        allUsers.splice(i, 1)
        localStorage.setItem('users', JSON.stringify(allUsers))
        displayUsers()
    } else {
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
                    <button onclick="deleteUser(${index})" class="btn btn-danger">Delete</button>
                </div>
            </div>
        `
    }
}