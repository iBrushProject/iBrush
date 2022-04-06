//用于登录页面验证细节
window.onload = function () {
    let submit = document.querySelector(".submit");
    submit.onclick = function () {
        let xm = document.getElementById("xm").value;
            if (!xm.length > 6) { 
                alert("账号长度应不超过6个字符！请重新输入"); 
            };
    };
};
