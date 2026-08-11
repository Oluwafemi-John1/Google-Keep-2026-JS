const allUsers = [];

const signUp = () => {
    const fName = document.getElementById('firstName').value
    const lName = document.getElementById('lastName').value
    const mail = document.getElementById('email').value
    const pass = document.getElementById('password').value

    // console.log(fName, lName, mail, pass);
    const user = {fName, lName, mail, pass}
    // if(fName.trim() == '' || )
    // console.log(user);
    allUsers.push(user);
    console.log(allUsers);
}

window.addEventListener('keypress',(e)=>{
    // console.log(e);
    if(e.key == 'Enter') {
        // console.log('enter ooo');
        signUp()
    }
})