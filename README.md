# Baby Tracker



## Cập nhật giao diện icon và dữ liệu demo đầy đủ

Phiên bản này bổ sung bộ icon **Material Symbols Rounded** cho navigation, Dashboard, thao tác nhanh, nút CRUD, timer, import CSV, modal, toast và trang cài đặt. Icon được tải qua Google Fonts cùng với font Be Vietnam Pro; nội dung và nhãn `aria-label` vẫn được giữ để hỗ trợ accessibility.

Admin mở **Cài đặt → Tạo/hoàn thiện dữ liệu demo** để tạo các hồ sơ còn thiếu:

- Hồ sơ demo cơ bản `Nguyễn An Nhiên (Bông)`.
- Hồ sơ demo đầy đủ `Trần Gia Hân (Mây)`.

Hồ sơ đầy đủ có dữ liệu tại tất cả 13 nhóm Firestore: tăng trưởng, tiêm phòng, khám bệnh, ăn uống, giấc ngủ, thay tã, triệu chứng, thuốc, lịch sử dùng thuốc, dị ứng, mốc phát triển, mọc răng và nhắc việc. Mỗi hồ sơ có marker riêng trong trường `notes`, vì vậy bấm nút nhiều lần không tạo trùng hồ sơ demo. Toàn bộ nội dung y tế trong demo chỉ dùng để thử giao diện, không phải tư vấn hoặc chỉ định y khoa.

Ứng dụng web tĩnh mobile-first để một nhóm thành viên gia đình được cấp quyền cùng ghi chép sức khỏe, sinh hoạt và quá trình phát triển của em bé.

> **Cảnh báo y tế:** Thông tin trong ứng dụng chỉ dùng để ghi chép và tham khảo, không thay thế việc thăm khám hoặc tư vấn của bác sĩ. Ứng dụng không tự chẩn đoán, kê đơn hoặc đề xuất liều thuốc.

## 1. Tính năng

- Google Sign-In với Firebase Authentication.
- Chỉ email tồn tại tại `allowedUsers/{email-viết-thường}` và có `active == true` mới được vào ứng dụng.
- Hai vai trò `admin` và `member`.
- Nhiều hồ sơ em bé trong một shared family workspace.
- Dashboard tổng hợp tăng trưởng, nhiệt độ, tiêm phòng, tái khám, ăn uống, ngủ, thay tã, triệu chứng, thuốc, dị ứng và nhắc việc.
- CRUD cho tăng trưởng, vaccine, khám bệnh, ăn uống, giấc ngủ, thay tã, triệu chứng, thuốc/vitamin, dị ứng, mốc phát triển, mọc răng và nhắc việc.
- Timer bú mẹ và timer giấc ngủ chạy khi trang module đang mở.
- Biểu đồ tăng trưởng và giấc ngủ bằng Chart.js.
- Quản lý allowed users dành riêng cho admin.
- Xuất JSON backup, CSV UTF-8 BOM và in tóm tắt đi khám.
- Nhập hàng loạt lịch tiêm phòng từ CSV với xem trước, validation và bỏ qua dữ liệu trùng.
- Dark mode, desktop sidebar, mobile bottom navigation, modal có focus trap, toast, loading/empty/error states.
- Không có backend riêng, Node.js, npm, build tool, Firebase Storage, Cloud Functions hoặc Admin SDK ở frontend.

## 2. Kiến trúc

```text
Browser / GitHub Pages
        │
        ├── index.html + CSS + JavaScript ES Modules
        │
        ├── Firebase Authentication ── Google Sign-In
        │             │
        │             └── onAuthStateChanged
        │
        └── Cloud Firestore
              ├── allowedUsers/{emailLowercase}
              └── babies/{babyId}/...
```

Ứng dụng là SPA nhỏ dùng hash routing, ví dụ `#/dashboard`, `#/growth`, `#/users`. `index.html` luôn ở root nên GitHub Pages không cần rewrite route phía server.

### Luồng Authentication và Authorization

```text
Mở website
   │
   ├── Firebase config còn YOUR_ ? ── Có ──> Màn hình lỗi cấu hình
   │
   └── Không
        │
        └── onAuthStateChanged
              │
              ├── Chưa đăng nhập ──> Màn hình Google Sign-In
              │
              └── Đã đăng nhập
                    │
                    ├── Chuẩn hóa email: trim().toLowerCase()
                    ├── GET allowedUsers/{email}
                    │
                    ├── Không tồn tại / inactive / role sai
                    │       └── Không tải dữ liệu sức khỏe, signOut
                    │
                    └── Hợp lệ
                            ├── Gán role vào app state
                            ├── Bắt đầu listener babies
                            └── Render Dashboard
```

Frontend ẩn chức năng không phù hợp với role để cải thiện UX. **Firestore Security Rules mới là lớp thực thi quyền truy cập thật sự.**

## 3. Mô hình chia sẻ dữ liệu

Phiên bản này dùng **shared family workspace**:

- Tất cả document hợp lệ và đang active trong `allowedUsers` được đọc dữ liệu của tất cả em bé.
- Admin và member đều có thể thêm, sửa, xóa hồ sơ bé và bản ghi theo dõi.
- Chỉ admin được list, tạo, sửa hoặc xóa `allowedUsers`.
- Thiết kế path tập trung theo `babies/{babyId}` để sau này có thể thêm `members`, `accessByBaby` hoặc family workspace ID, nhưng MVP chưa triển khai quyền riêng từng bé.

## 4. Cấu trúc thư mục

```text
baby-tracker/
├── index.html
├── README.md
├── firestore.rules
├── firestore.indexes.json
├── .nojekyll
├── css/
│   ├── variables.css
│   ├── reset.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   ├── forms.css
│   ├── utilities.css
│   └── responsive.css
├── js/
│   ├── firebase-config.js
│   ├── firebase-service.js
│   ├── auth.js
│   ├── authorization.js
│   ├── app-state.js
│   ├── router.js
│   ├── navigation.js
│   ├── firestore-service.js
│   ├── ui.js
│   ├── modal.js
│   ├── toast.js
│   ├── validators.js
│   ├── date-utils.js
│   ├── export-utils.js
│   ├── demo-data.js
│   ├── app.js
│   └── modules/
│       ├── module-factory.js
│       ├── dashboard.js
│       ├── babies.js
│       ├── growth.js
│       ├── vaccinations.js
│       ├── medical-visits.js
│       ├── feeding.js
│       ├── sleep.js
│       ├── diapers.js
│       ├── symptoms.js
│       ├── medications.js
│       ├── allergies.js
│       ├── milestones.js
│       ├── teething.js
│       ├── reminders.js
│       ├── reports.js
│       ├── allowed-users.js
│       └── settings.js
└── assets/
    ├── icons/
    └── images/
        └── baby-placeholder.svg
```

## 5. Công nghệ và phiên bản

- HTML5, CSS3, JavaScript ES Modules.
- Firebase Web SDK modular **12.16.0**, tải từ CDN chính thức `www.gstatic.com`.
- Chart.js **4.5.1** qua jsDelivr.
- Lucide UMD qua CDN; ứng dụng vẫn dùng được nếu icon CDN không tải vì navigation có ký hiệu text dự phòng.
- `Intl.DateTimeFormat` với múi giờ hiển thị `Asia/Ho_Chi_Minh`.

Tất cả Firebase imports đều khóa cùng phiên bản 12.16.0. Không trộn modular và compat API.

## 6. Firestore data model

```text
allowedUsers/{email}
babies/{babyId}
babies/{babyId}/growthRecords/{recordId}
babies/{babyId}/vaccinations/{recordId}
babies/{babyId}/medicalVisits/{recordId}
babies/{babyId}/feedingRecords/{recordId}
babies/{babyId}/sleepRecords/{recordId}
babies/{babyId}/diaperRecords/{recordId}
babies/{babyId}/symptomRecords/{recordId}
babies/{babyId}/medications/{recordId}
babies/{babyId}/medicationLogs/{recordId}
babies/{babyId}/allergies/{recordId}
babies/{babyId}/milestones/{recordId}
babies/{babyId}/teethingRecords/{recordId}
babies/{babyId}/reminders/{recordId}
```

Mỗi document theo dõi có:

```javascript
{
  createdByUid: "Firebase Auth UID",
  createdByEmail: "email@example.com",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

Khi update, `firestore-service.js` loại bỏ metadata tạo và chỉ ghi lại `updatedAt`. Rules xác nhận `createdByUid`, `createdByEmail`, `createdAt` không đổi.

## 7. Chạy local

Không mở trực tiếp bằng `file:///...` vì ES Modules và Firebase Auth cần HTTP origin.

### Cách 1: VS Code Live Server

1. Mở VS Code.
2. Chọn **File > Open Folder** và chọn thư mục `baby-tracker`.
3. Mở tab Extensions hoặc nhấn `Ctrl+Shift+X`.
4. Tìm **Live Server** và cài extension của Ritwick Dey.
5. Trong Explorer, chuột phải `index.html`.
6. Chọn **Open with Live Server**.
7. Trình duyệt thường mở địa chỉ như `http://127.0.0.1:5500` hoặc `http://localhost:5500`.
8. Trong Firebase Authentication > Settings > Authorized domains, bảo đảm `localhost` đã có. Với `127.0.0.1`, nên truy cập lại bằng `http://localhost:5500` để dùng domain đã cho phép.

**Kiểm tra thành công:** trang Baby Tracker xuất hiện; nếu config chưa thay, màn hình “Chưa cấu hình Firebase” xuất hiện thay vì lỗi JavaScript trắng trang.

### Cách 2: Python HTTP Server

Từ terminal tại thư mục `baby-tracker`:

```bash
python -m http.server 5500
```

Nếu lệnh `python` không tồn tại trên Windows, thử:

```bash
py -m http.server 5500
```

Mở:

```text
http://localhost:5500
```

Dừng server bằng `Ctrl+C`.

## 8. Thiết lập Firebase từng bước

Giao diện Firebase Console có thể đổi nhẹ theo thời gian, nhưng tên sản phẩm và logic cấu hình vẫn tương tự.

### Bước 1: Tạo Firebase Project

1. Mở Firebase Console và đăng nhập Google.
2. Ở màn hình project, bấm **Create a project** hoặc **Add project**.
3. Nhập Project name, ví dụ `baby-tracker-family`.
4. Firebase đề xuất Project ID. Project name có thể trùng, nhưng Project ID phải duy nhất toàn cầu.
5. Project ID có thể xuất hiện trong `authDomain`, URL dịch vụ và log; không dùng nội dung bí mật trong Project ID.
6. Bấm **Continue**.
7. Google Analytics không bắt buộc cho ứng dụng này. Có thể tắt để setup đơn giản, hoặc bật nếu gia đình thực sự cần analytics và hiểu vấn đề dữ liệu riêng tư.
8. Bấm **Create project**.
9. Chờ đến khi có thông báo hoàn tất, bấm **Continue**.
10. **Kết quả mong đợi:** trang **Project Overview** của project mới xuất hiện.

### Bước 2: Đăng ký Firebase Web App

1. Tại Project Overview, bấm biểu tượng Web `</>`.
2. App nickname: `Baby Tracker Web`.
3. Không chọn Firebase Hosting; source sẽ được host trên GitHub Pages.
4. Bấm **Register app**.
5. Firebase hiển thị object `firebaseConfig`.
6. Mở `js/firebase-config.js`.
7. Thay toàn bộ placeholder:

```javascript
export const firebaseConfig = {
  apiKey: "giá-trị-từ-console",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

8. Không sao chép service account, private key, OAuth client secret hoặc Admin SDK credential.
9. Lưu file.
10. **Kiểm tra thành công:** không còn chuỗi `YOUR_` trong `firebase-config.js`; reload local app sẽ chuyển từ màn hình lỗi config sang màn hình đăng nhập.

#### Firebase Web Config có phải bí mật không?

Không. Web config là định danh client được gửi đến trình duyệt. Nó không cấp quyền quản trị. Dữ liệu phải được bảo vệ bằng:

- Firebase Authentication.
- Firestore Security Rules.
- Giới hạn danh sách `allowedUsers`.
- App Check tùy chọn sau khi MVP ổn định.

### Bước 3: Bật Google Authentication

1. Trong Firebase Console, mở **Build > Authentication**; ở giao diện mới có thể nằm trong nhóm **Build** hoặc **Run**.
2. Nếu chưa dùng Authentication, bấm **Get started**.
3. Mở tab **Sign-in method** hoặc **Providers**.
4. Chọn **Google**.
5. Bật **Enable**.
6. Chọn Project support email.
7. Bấm **Save**.
8. **Kiểm tra thành công:** Google hiển thị trạng thái **Enabled**.

Ứng dụng chỉ gọi `signInWithPopup()` từ click trực tiếp của nút. Email/password không được sử dụng.

### Bước 4: Authorized Domains

1. Mở **Authentication**.
2. Mở **Settings**.
3. Tìm **Authorized domains**.
4. Kiểm tra `localhost`; thêm nếu chưa có.
5. Sau khi GitHub Pages hoạt động, bấm **Add domain**.
6. Nhập hostname, ví dụ:

```text
hieunguyen.github.io
```

Không nhập:

```text
https://hieunguyen.github.io/baby-tracker/
```

Không nhập `https://`, dấu `/`, hoặc path repository.

**Kiểm tra thành công:** hostname xuất hiện trong danh sách; đăng nhập Google từ URL GitHub Pages không còn lỗi `auth/unauthorized-domain`.

### Bước 5: Tạo Cloud Firestore

1. Trong Firebase Console, mở **Build > Firestore Database** hoặc **Databases & Storage > Firestore**.
2. Bấm **Create database**.
3. Chọn **Firestore Standard edition** / chế độ Firebase Native phù hợp với Web SDK thông thường.
4. Không chọn chế độ tương thích MongoDB nếu project của bạn có lựa chọn này.
5. Chọn **Production mode** để mặc định từ chối truy cập cho đến khi rules được publish.
6. Chọn location gần người dùng và phù hợp với các dịch vụ dự kiến dùng sau này.
7. Với gia đình ở Việt Nam, xem danh sách location hiện hành trong Console và cân nhắc khu vực châu Á. Không chọn tùy tiện: location mặc định khó hoặc không thể đổi trực tiếp sau khi đã tạo.
8. Bấm **Enable** hoặc **Create**.
9. **Kiểm tra thành công:** xuất hiện các tab **Data**, **Rules**, **Indexes**.

### Bước 6: Tạo admin đầu tiên thủ công

Admin đầu tiên không thể tự tạo qua frontend vì chưa có admin nào được Rules cho phép quản lý `allowedUsers`.

1. Mở Firestore Database.
2. Chọn tab **Data**.
3. Bấm **Start collection**.
4. Collection ID: `allowedUsers`.
5. Bấm **Next**.
6. Document ID: email Google của admin, viết thường hoàn toàn, ví dụ `admin@gmail.com`.
7. Không chọn Auto-ID.
8. Tạo các field:

| Field | Type | Ví dụ |
|---|---|---|
| `email` | string | `admin@gmail.com` |
| `displayName` | string | `Admin` |
| `role` | string | `admin` |
| `active` | boolean | `true` |
| `createdByEmail` | string | `admin@gmail.com` |
| `createdAt` | timestamp | thời gian hiện tại |
| `updatedAt` | timestamp | thời gian hiện tại |

9. Bấm **Save**.
10. Mở lại document và kiểm tra:
    - ID đúng chính xác với email.
    - Email không có chữ hoa hoặc khoảng trắng.
    - `active` là boolean, không phải string `"true"`.
    - `role` đúng là `admin`.

Lỗi thường gặp:

- Dùng Auto-ID.
- Collection tên `allowedUser` thay vì `allowedUsers`.
- Document ID khác field `email`.
- Email có chữ hoa.
- `active` sai type.
- `role` viết `Admin`, `administrator` hoặc giá trị khác.

### Bước 7: Publish Firestore Security Rules

1. Mở file `firestore.rules` trong repository.
2. Sao chép toàn bộ nội dung, bắt đầu từ `rules_version = '2';`.
3. Trong Firebase Console mở Firestore Database.
4. Chọn tab **Rules**.
5. Xóa rules mặc định.
6. Dán rules của project.
7. Bấm **Publish**.
8. Nếu Console báo lỗi cú pháp, không bỏ các điều kiện bảo mật để “cho chạy”; kiểm tra vị trí lỗi và đảm bảo đã sao chép trọn file.
9. **Kiểm tra thành công:** Console hiển thị thời điểm publish mới và không có lỗi.

Không dùng:

```javascript
allow read, write: if true;
```

Không dùng rule rộng chỉ kiểm tra `request.auth != null` cho toàn bộ database.

#### Rules không phải bộ lọc

Query phải có khả năng chứng minh toàn bộ kết quả đều được Rules cho phép. Rules không nhận một query rộng rồi tự loại document không được phép. Trong MVP, toàn bộ active users dùng chung workspace nên các query trên `babies` và subcollections phù hợp với `isAllowed()`.

### Bước 8: Kiểm thử Rules

Rules Playground có thể thay đổi vị trí trong Console. Nếu có:

1. Mở Firestore > Rules.
2. Chọn **Rules Playground** / **Simulator**.
3. Chọn operation và path.
4. Với authenticated request, nhập UID và email token phù hợp.
5. Chạy các case:

| Case | Kết quả mong đợi |
|---|---|
| Không đăng nhập đọc `babies/x` | Deny |
| Member active đọc `babies/x` | Allow |
| Member get chính `allowedUsers/member@gmail.com` | Allow |
| Member list `allowedUsers` | Deny |
| Admin list `allowedUsers` | Allow |
| Member tạo allowed user | Deny |
| Admin xóa chính document email của mình | Deny |
| Admin đổi role chính mình thành member | Deny |
| Admin đặt active chính mình false | Deny |
| User active false đọc dữ liệu bé | Deny |

Nếu Playground không mô phỏng thuận tiện `exists/get`, dùng Firebase Emulator Suite trong một nhánh phát triển sau này. Repository MVP không bắt buộc Node.js để chạy web, nhưng Emulator CLI là công cụ kiểm thử nâng cao riêng.

### Bước 9: Đăng nhập admin và tạo member

1. Chạy local app bằng HTTP server.
2. Bấm **Đăng nhập bằng Google**.
3. Chọn đúng tài khoản admin đã thêm trong `allowedUsers`.
4. Mở **Người dùng** trong sidebar desktop hoặc **Cài đặt > Quản lý người dùng** trên mobile.
5. Bấm **Thêm người dùng**.
6. Nhập email member.
7. Chọn role `Member`.
8. Giữ active bật.
9. Lưu.
10. Đăng xuất admin.
11. Đăng nhập member.
12. **Kiểm tra:** member không thấy trang Người dùng nhưng vẫn thao tác được dữ liệu bé.

Nếu UI quản trị chưa hoạt động, tạo member thủ công giống Bước 6 nhưng đặt `role = member` và `createdByEmail` là email admin.

### Bước 10: Firestore Indexes

`firestore.indexes.json` hiện để danh sách composite index rỗng. Ứng dụng ưu tiên query một `orderBy` và filter nhỏ ở client nên chỉ dùng single-field indexes mặc định.

Khi xuất hiện lỗi thiếu index:

1. Mở DevTools bằng `F12`.
2. Chọn Console.
3. Tìm lỗi Firestore có link tạo index.
4. Mở link.
5. Kiểm tra collection/subcollection, fields và sort direction.
6. Bấm **Create index**.
7. Mở Firestore > Indexes.
8. Chờ trạng thái **Building** chuyển thành **Enabled**.
9. Reload app.

Không tạo hàng loạt index không sử dụng vì tăng thời gian quản lý và có thể ảnh hưởng chi phí ghi.

### Bước 11: Kiểm tra dữ liệu

1. Trong ứng dụng tạo một hồ sơ em bé.
2. Mở Firestore > Data.
3. Mở collection `babies`.
4. Kiểm tra document có `createdByUid`, `createdByEmail`, `createdAt`, `updatedAt`.
5. Trong app thêm một bản ghi tăng trưởng.
6. Trong Console mở document bé > subcollection `growthRecords`.
7. Kiểm tra field số đúng type number và thời gian đúng type timestamp.
8. Sửa bản ghi trong app.
9. Kiểm tra `createdAt` không đổi, `updatedAt` thay đổi.

### Bước 12: App Check tùy chọn nâng cao

Chỉ triển khai sau khi Authentication, Firestore và Rules đã ổn định.

1. Trong Firebase Console mở **Security > App Check**.
2. Chọn Web App đã đăng ký.
3. Với tích hợp mới, ưu tiên **reCAPTCHA Enterprise** theo khuyến nghị Firebase hiện hành.
4. Đăng ký domain GitHub Pages đúng hostname.
5. Thêm import `firebase-app-check.js` cùng phiên bản 12.16.0.
6. Khởi tạo App Check ngay sau `initializeApp()` và trước khi gọi Firestore.
7. Deploy ở chế độ chưa enforcement.
8. Theo dõi metrics request hợp lệ/không hợp lệ.
9. Chỉ bật enforcement sau khi local, GitHub Pages, các trình duyệt chính và tài khoản thật đều hoạt động.
10. Với localhost, dùng App Check debug provider; không đưa debug token vào repository.
11. Không thêm `localhost` vào allowlist reCAPTCHA chỉ để né debug provider.

App Check bổ sung bảo vệ abuse, không thay thế Authentication hoặc Security Rules.

## 9. Triển khai GitHub Pages

### Bước 1: Tạo repository

1. Đăng nhập GitHub.
2. Bấm **New repository**.
3. Repository name: `baby-tracker`.
4. Chọn Public hoặc Private tùy gói GitHub và quyền Pages hiện hành của tài khoản.
5. Không thêm service account, private key hoặc file credential bí mật.
6. Tạo repository.

### Bước 2: Upload source

Upload toàn bộ nội dung bên trong thư mục `baby-tracker`, bảo đảm có:

```text
index.html
css/
js/
assets/
README.md
firestore.rules
firestore.indexes.json
.nojekyll
```

`index.html` phải ở root của publishing source.

### Bước 3: Kiểm tra relative paths

Đúng:

```html
<link rel="stylesheet" href="./css/base.css">
<script type="module" src="./js/app.js"></script>
```

Đúng trong JavaScript:

```javascript
import { showToast } from "./toast.js";
import { renderRecordModule } from "./module-factory.js";
```

Không dùng path bắt đầu bằng `/` như `/js/app.js`, vì project site chạy dưới `/baby-tracker/`.

### Bước 4: Bật Pages

1. Mở repository.
2. Chọn **Settings**.
3. Trong sidebar chọn **Pages**.
4. Phần **Build and deployment**, Source chọn **Deploy from a branch**.
5. Branch chọn `main`.
6. Folder chọn `/(root)`.
7. Bấm **Save**.
8. Mở tab **Actions** hoặc quay lại Pages để theo dõi deployment.
9. Khi thành công, GitHub hiển thị URL dạng:

```text
https://YOUR_USERNAME.github.io/baby-tracker/
```

File `.nojekyll` vô hiệu xử lý Jekyll không cần thiết cho static app này.

### Bước 5: Thêm domain Pages vào Firebase

1. Sao chép hostname từ URL, ví dụ `YOUR_USERNAME.github.io`.
2. Firebase Console > Authentication > Settings > Authorized domains.
3. Bấm **Add domain**.
4. Dán hostname, không có protocol/path.
5. Lưu.
6. Reload GitHub Pages.
7. Test Google Sign-In.

### Bước 6: Checklist deployment

- [ ] CSS tải, không có trang trắng.
- [ ] Không có 404 cho `js/app.js` hoặc module con.
- [ ] Firebase config đã thay placeholder.
- [ ] Google popup mở từ click.
- [ ] Domain đã authorized.
- [ ] Tài khoản không trong allowedUsers bị sign out.
- [ ] Dashboard chỉ xuất hiện sau khi kiểm tra quyền.
- [ ] Firestore đọc/ghi thành công.
- [ ] Member không thấy trang Người dùng.
- [ ] Rules vẫn chặn member nếu cố gọi trực tiếp.
- [ ] Dark mode hoạt động.
- [ ] Layout usable trên điện thoại.

## 10. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân thường gặp | Cách sửa |
|---|---|---|
| `auth/unauthorized-domain` | Chưa thêm GitHub Pages hostname; nhập cả URL/path | Thêm đúng `username.github.io` trong Authentication > Authorized domains |
| `auth/popup-blocked` | Popup không từ click trực tiếp; trình duyệt chặn | Cho phép popup; giữ lời gọi `signInWithPopup()` trực tiếp trong click handler |
| `auth/popup-closed-by-user` | Người dùng đóng popup | Không cần sửa hệ thống; bấm đăng nhập lại |
| `auth/operation-not-allowed` | Google provider chưa bật | Authentication > Sign-in method > Google > Enable |
| `permission-denied` | Email/ID sai, inactive, role sai, Rules chưa publish | Kiểm tra `allowedUsers/{email-lowercase}`, type fields và Rules |
| `Failed to resolve module specifier` | Sai `./` hoặc `../`; mở bằng `file://` | Sửa import và chạy HTTP server |
| 404 trên GitHub Pages | Path bắt đầu `/`; sai hoa/thường; Pages publish sai branch | Dùng relative path; kiểm tra file/branch/root |
| Firebase config invalid | Còn `YOUR_`; copy sai app config | Copy lại Web App config vào `js/firebase-config.js` |
| Missing index | Query cần composite index | Mở link lỗi, tạo index, chờ Enabled |
| Dashboard không có dữ liệu | Chưa chọn bé hoặc document thiếu field orderBy | Chọn bé; kiểm tra field timestamp bắt buộc |
| App đăng nhập rồi thoát ngay | allowed user không tồn tại/inactive/role sai | Sửa document ID và fields trong Firestore |

## 11. Backup và export

1. Chọn em bé.
2. Mở **Báo cáo & xuất dữ liệu**.
3. Bấm **Tải backup JSON** để tải hồ sơ và tối đa 1.000 record mỗi subcollection.
4. Bấm từng module CSV để mở trong Excel. CSV có UTF-8 BOM và escape dấu phẩy, dấu nháy, xuống dòng.
5. Bấm **In tóm tắt đi khám** và chọn Save as PDF nếu muốn lưu bản in.

### Nhập lịch tiêm phòng từ CSV

1. Mở màn hình **Tiêm phòng**.
2. Chọn **Tải CSV mẫu** để lấy file có đúng tên và thứ tự cột.
3. Mở file bằng Excel hoặc Google Sheets và nhập dữ liệu. Các cột bắt buộc gồm `Tên vaccine`, `Mũi số`, `Ngày dự kiến`, `Trạng thái`.
4. Ngày giờ nên dùng định dạng `dd/mm/yyyy HH:mm`, ví dụ `13/07/2026 09:30`.
5. Trạng thái có thể dùng tiếng Việt: `Đã lên lịch`, `Sắp đến hạn`, `Đã tiêm`, `Quá hạn`, `Đã hủy`; ứng dụng cũng chấp nhận các mã `scheduled`, `upcoming`, `completed`, `overdue`, `cancelled`.
6. Lưu dưới dạng CSV UTF-8, quay lại ứng dụng và chọn **Nhập CSV**.
7. Kiểm tra bảng xem trước. Dòng sai định dạng hoặc trùng `Tên vaccine + Mũi số + Ngày dự kiến` sẽ bị bỏ qua.
8. Chọn **Nhập ... mũi tiêm** để ghi các dòng hợp lệ vào Firestore bằng batch write.

Mỗi lần nhập tối đa 400 dòng và file không được lớn hơn 2 MB.

Tên file có timestamp ngày, ví dụ:

```text
baby-tracker-growthRecords-2026-07-13.csv
baby-tracker-backup-2026-07-13.json
```

Đây là export phía browser, không phải backup tự động cấp hạ tầng. Với dữ liệu quan trọng, duy trì lịch backup định kỳ và kiểm tra file có mở được.

## 12. Checklist kiểm thử

### Authentication

- [ ] Google đăng nhập thành công.
- [ ] Popup bị đóng hiển thị thông báo nhẹ.
- [ ] Popup bị chặn hiển thị hướng dẫn.
- [ ] Domain chưa cho phép hiển thị lỗi tiếng Việt.
- [ ] Đăng xuất xóa dữ liệu cũ khỏi UI.
- [ ] Reload vẫn giữ phiên bằng browser local persistence.
- [ ] User không được phép bị sign out trước khi Dashboard render.
- [ ] User `active == false` bị từ chối.

### Authorization

- [ ] Admin thấy trang Người dùng.
- [ ] Member không thấy trang Người dùng.
- [ ] Member nhập trực tiếp `#/users` bị chuyển về Dashboard.
- [ ] Rules từ chối member list/create/update/delete allowedUsers.
- [ ] Admin không thể tự xóa.
- [ ] Admin không thể tự khóa.
- [ ] Admin không thể tự đổi role xuống member.

### CRUD

Với từng module, test:

- [ ] Thêm record hợp lệ.
- [ ] Form thiếu field bắt buộc bị chặn.
- [ ] Sửa record giữ nguyên metadata tạo.
- [ ] Xóa có confirm.
- [ ] Loading/empty/error state.
- [ ] Đổi bé không còn listener/data của bé cũ.
- [ ] Lọc ngày và tìm kiếm.
- [ ] CSV đúng tiếng Việt.

### Dữ liệu đặc biệt

- [ ] Ngày sinh tương lai bị chặn.
- [ ] Cân nặng/chiều cao/vòng đầu <= 0 bị chặn.
- [ ] Nhiệt độ ngoài 30–45°C bị chặn ở form.
- [ ] Lượng sữa âm bị chặn.
- [ ] Kết thúc ngủ trước bắt đầu bị chặn.
- [ ] Kết thúc thuốc trước bắt đầu bị chặn.
- [ ] URL không phải HTTP/HTTPS bị chặn.
- [ ] Text dài bị giới hạn.
- [ ] Dữ liệu nhập chứa HTML/script chỉ hiển thị như text.

### UI/Accessibility

- [ ] Mobile 360px.
- [ ] Tablet.
- [ ] Desktop.
- [ ] Dark mode.
- [ ] Tab keyboard đi qua nút/input hợp lý.
- [ ] Escape đóng modal.
- [ ] Focus không thoát modal khi nhấn Tab.
- [ ] Focus-visible rõ.
- [ ] Reduced motion được tôn trọng.
- [ ] Trạng thái không chỉ truyền bằng màu.

## 13. Checklist bảo mật

- [ ] Firestore không ở test mode.
- [ ] Rules đã publish và test.
- [ ] Không commit service account/private key/client secret/debug token.
- [ ] Không dùng Admin SDK trong browser.
- [ ] Không có public signup.
- [ ] Document ID allowedUsers là email lowercase.
- [ ] Chỉ admin quản lý allowedUsers.
- [ ] Member bị Rules chặn, không chỉ ẩn nút.
- [ ] Không lưu hồ sơ y tế trong localStorage.
- [ ] Chỉ lưu selected baby ID và theme trong localStorage.
- [ ] Không ghi nội dung sức khỏe vào console; chỉ log object lỗi kỹ thuật.
- [ ] Giới hạn người được cấp quyền.
- [ ] Xóa quyền ngay khi người không còn cần truy cập.
- [ ] Backup định kỳ.
- [ ] Cân nhắc App Check sau khi MVP ổn định.
- [ ] Đánh giá nghĩa vụ pháp lý/quyền riêng tư phù hợp nơi sử dụng.

## 14. Dữ liệu demo

Chỉ admin thấy nút **Tạo dữ liệu demo** trong Cài đặt.

- Không tự động ghi.
- Hiển thị confirm trước khi tạo.
- Dùng batch write cho hồ sơ và record.
- Hồ sơ demo chứa marker `[BABY_TRACKER_DEMO_V1]` để UI tránh tạo trùng.
- Nội dung vaccine/thuốc demo chỉ minh họa, không phải lịch hoặc liều khuyến nghị.

## 15. Giới hạn của phiên bản static

- Không có server chạy nền.
- Reminder chỉ xuất hiện khi người dùng mở website.
- Không có push notification thật khi website đóng.
- Timer chỉ được giữ trong bộ nhớ của tab/module; rời module hoặc reload sẽ dừng timer chưa lưu.
- Không upload file; ảnh/chứng từ chỉ lưu URL.
- Không có cascade delete server-side. UI chỉ cho xóa hồ sơ bé khi không tìm thấy record con trong các subcollection đã biết.
- Backup browser giới hạn 1.000 record mỗi module trong một lần tải.
- Shared workspace chưa có quyền riêng theo từng bé.
- Chưa tích hợp chuẩn tăng trưởng WHO; ứng dụng không tự diễn giải chỉ số.
- Không có audit log bất biến; metadata chỉ cho biết người tạo và thời gian cập nhật gần nhất.
- Google popup có thể kém thuận tiện trên một số mobile browser; đặc tả MVP yêu cầu popup nên app chưa chuyển sang redirect.

## 16. Hướng nâng cấp

1. App Check với reCAPTCHA Enterprise, theo dõi metrics trước enforcement.
2. Family workspace ID và membership riêng, thay vì collection global.
3. Quyền read/write theo từng em bé.
4. Audit log append-only.
5. Soft delete và quy trình khôi phục.
6. Cloud Functions/Cloud Run cho reminder server-side và cascade deletion, nếu chấp nhận có backend.
7. Firebase Storage hoặc dịch vụ file riêng với Rules chặt chẽ.
8. PWA/offline strategy được kiểm thử kỹ.
9. Phân trang thực sự bằng `startAfter` cho bộ dữ liệu lớn.
10. Import JSON backup có validate schema.
11. WHO growth standard chỉ sau khi chọn nguồn chính thức, version hóa dataset và kiểm chứng cách tính.
12. Test tự động bằng Firebase Emulator Suite và browser E2E.
13. Content Security Policy phù hợp với CDN hoặc self-host dependencies.
14. Consent, retention policy, access review và quy trình xóa dữ liệu theo yêu cầu.

## 17. Nguồn tài liệu chính thức

- Firebase Web setup: `https://firebase.google.com/docs/web/setup`
- Firebase CDN alternatives: `https://firebase.google.com/docs/web/alt-setup`
- Google Sign-In: `https://firebase.google.com/docs/auth/web/google-signin`
- Firestore quickstart: `https://firebase.google.com/docs/firestore/quickstart`
- Firestore Rules conditions: `https://firebase.google.com/docs/firestore/security/rules-conditions`
- App Check Web: `https://firebase.google.com/docs/app-check/web/recaptcha-provider`
- App Check debug provider: `https://firebase.google.com/docs/app-check/web/debug-provider`
- GitHub Pages publishing source: `https://docs.github.com/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site`
- Chart.js docs: `https://www.chartjs.org/docs/latest/`
