<?php
$host = "localhost";
$port = 8889;
$dbname = "beacon_db";
$username = "root";
$password = "root";

$conn = new mysqli($host, $username, $password, $dbname, $port);
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}

$sql = "SELECT * FROM users";
$result = $conn->query($sql);

if ($result->num_rows === 0) {
  echo "<tr><td colspan='5'>ไม่พบข้อมูลผู้ใช้</td></tr>";
} else {
  while ($row = $result->fetch_assoc()) {
    echo "<tr id='user-{$row['id']}'>
      <td>{$row['citizen_id']}</td>
      <td contenteditable='true' class='first-name'>{$row['first_name']}</td>
      <td contenteditable='true' class='last-name'>{$row['last_name']}</td>
      <td>
        <select class='role'>
          <option value='admin' " . ($row['role'] === 'admin' ? 'selected' : '') . ">ผู้ดูแลระบบ</option>
          <option value='manager' " . ($row['role'] === 'manager' ? 'selected' : '') . ">ผู้บริหาร</option>
          <option value='staff' " . ($row['role'] === 'staff' ? 'selected' : '') . ">เจ้าหน้าที่</option>
        </select>
      </td>
      <td>
        <button onclick='updateUser({$row['id']})'>อัปเดต</button>
        <button onclick='deleteUser({$row['id']})'>ลบ</button>
      </td>
    </tr>";
  }
}

$conn->close();
?>
