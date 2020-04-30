const request = require("request-promise");

var testGetProfileById = function (studentID) {
    console.log(`https://eecon43.nu.ac.th/checkstudent/${studentID}/`);

    request({
        method: "GET",
        uri: `https://eecon43.nu.ac.th/checkstudent/${studentID}/`
    }).then(function (data) {
        console.log('getdata');
        //console.log(data);
        studentObj = JSON.parse(data);

        if (studentObj.result == "OK") {
            // นำข้อมูลมา รอตรวจสอบ pid
            console.log("PID is " + studentObj.pid);
        } else {
            // ไม่พบข้อมูล
            // agent.add("แจ้งผู้ใช้ รหัสนิสิตของคุณ อาจจะไม่ถูกต้อง กรุณาพิมพ์ใหม่  ");
            // หรือจะ ขึ้นให้ผู้ใช้เลือกว่า จะยังที่จะลงทะเบียนต่อ หรือไม่  ถ้า ใช่ ก็ให้ผู้ใช้พิมพ์ รหัสนิสิต อีกครั้ง หรือถ้าไม่ ก็ จบ intent นี้ไปเลย

        }

    }).catch(function (err) {
        console.log('Error:', err.message);
    });
}

testGetProfileById(59365827);