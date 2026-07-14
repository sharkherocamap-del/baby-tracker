# Baby Tracker — Family Workspace Edition

Ứng dụng web tĩnh để gia đình theo dõi sức khỏe, sinh hoạt và quá trình phát triển của em bé. Ứng dụng chạy trực tiếp trên GitHub Pages, dùng JavaScript ES Modules, Firebase Authentication, Cloud Firestore, Cloud Storage và Chart.js; không cần server riêng hoặc bước build.

> Thông tin trong ứng dụng chỉ dùng để ghi chép và tham khảo, không thay thế việc thăm khám hoặc tư vấn của bác sĩ. Chỉ số WHO là tham chiếu thống kê, không phải chẩn đoán.

## 1. Những nâng cấp chính

Phiên bản này bổ sung sáu nhóm chức năng lớn:

1. **Family workspace và membership riêng**
   - Một tài khoản có thể thuộc nhiều workspace gia đình.
   - Dữ liệu em bé nằm dưới đúng workspace, không còn dùng collection sức khỏe global.
   - Ba vai trò: `admin`, `member`, `viewer`.
   - Chủ workspace luôn phải là admin đang hoạt động.
   - Lời mời gắn với email Google và được nhận tự động khi người đó đăng nhập.

2. **Soft delete và khôi phục**
   - Xóa thông thường chỉ chuyển document vào Thùng rác.
   - Admin/member có thể khôi phục.
   - Chỉ admin được xóa vĩnh viễn.
   - Khi purge hồ sơ bé, ứng dụng xử lý toàn bộ subcollection và ảnh Storage có liên quan.

3. **Firebase Storage cho ảnh**
   - Upload ảnh đại diện và ảnh mốc phát triển.
   - Chấp nhận JPG, PNG, WebP, GIF; tối đa 5 MB.
   - Storage Rules kiểm tra membership, role, MIME type, kích thước và metadata workspace/baby.

4. **Phân trang thật bằng Firestore `startAfter()`**
   - Mỗi màn hình tải từng trang bằng cursor `DocumentSnapshot`.
   - Có Trang trước/Trang sau và cache các trang đã mở trong phiên màn hình.
   - Báo cáo, backup, migration và kiểm tra trùng CSV cũng đọc tuần tự qua cursor thay vì một query không giới hạn.

5. **Import JSON backup có validate schema — chỉ admin**
   - Backup schema version 2.
   - Whitelist collection và field.
   - Kiểm tra kiểu dữ liệu, enum, ngày giờ, range số, ID trùng và liên kết nội bộ.
   - Import thành hồ sơ mới, không ghi đè hồ sơ đang có.
   - Tự ánh xạ ID thuốc/nhắc việc sang ID mới.
   - Có rollback các batch đã commit nếu import bị gián đoạn.

6. **WHO Child Growth Standards 0–5 tuổi**
   - Cân nặng theo tuổi.
   - Chiều dài/chiều cao theo tuổi.
   - Vòng đầu theo tuổi.
   - Dùng dữ liệu LMS chính thức theo từng ngày tuổi và giới tính.
   - Hiển thị z-score, percentile tham chiếu trong ±3 SD và đường trung vị/±2 SD trên biểu đồ.
   - Không tự kết luận thiếu cân, thấp còi, thừa cân hoặc bệnh lý.

## 2. Công nghệ

- HTML5, CSS3, JavaScript ES Modules.
- Firebase JavaScript SDK **12.16.0** qua CDN chính thức.
- Firebase Authentication — Google Sign-In.
- Cloud Firestore.
- Cloud Storage for Firebase.
- Chart.js **4.5.1**.
- Material Symbols Rounded.
- GitHub Pages.
- Không React/Vue/Angular, không Node.js trong runtime, không bundler trong deployment.

## 3. Kiến trúc dữ liệu

### 3.1 User profile

```text
users/{uid}
```

```javascript
{
  uid: "firebase-auth-uid",
  email: "user@gmail.com",
  displayName: "Tên hiển thị",
  photoURL: "https://...",
  active: true,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 3.2 Workspace

```text
workspaces/{workspaceId}
```

```javascript
{
  name: "Gia đình Nguyễn",
  slug: "gia-dinh-nguyen",
  active: true,
  ownerUid: "uid-admin-đầu-tiên",
  createdByUid: "...",
  createdByEmail: "...",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  legacyMigrationStatus: "pending | completed | not-applicable"
}
```

### 3.3 Membership

```text
workspaces/{workspaceId}/members/{uid}
```

```javascript
{
  uid: "...",
  email: "member@gmail.com",
  displayName: "Mẹ",
  role: "admin | member | viewer",
  active: true,
  invitedByUid: "...",
  invitedByEmail: "...",
  joinedAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Quyền:

| Role | Đọc | Thêm/sửa/xóa mềm | Khôi phục | Xóa vĩnh viễn | Quản lý thành viên | Import JSON |
|---|---:|---:|---:|---:|---:|---:|
| admin | Có | Có | Có | Có | Có | Có |
| member | Có | Có | Có | Không | Không | Không |
| viewer | Có | Không | Không | Không | Không | Không |

Chủ workspace không thể bị hạ role, khóa hoặc xóa membership. Admin cũng không thể tự khóa hoặc tự hạ role của chính mình.

### 3.4 Lời mời

Hai bản mirror được ghi atomically:

```text
workspaceInvites/{email}/memberships/{workspaceId}
workspaces/{workspaceId}/invites/{email}
```

- Bản đầu cho người được mời tìm lời mời theo đúng email đăng nhập.
- Bản thứ hai cho admin workspace quản lý danh sách lời mời.
- Khi đăng nhập, membership được tạo với UID thật và lời mời chuyển thành `claimed`.

### 3.5 Dữ liệu em bé

```text
workspaces/{workspaceId}/babies/{babyId}
workspaces/{workspaceId}/babies/{babyId}/growthRecords/{recordId}
workspaces/{workspaceId}/babies/{babyId}/vaccinations/{recordId}
workspaces/{workspaceId}/babies/{babyId}/medicalVisits/{recordId}
workspaces/{workspaceId}/babies/{babyId}/feedingRecords/{recordId}
workspaces/{workspaceId}/babies/{babyId}/sleepRecords/{recordId}
workspaces/{workspaceId}/babies/{babyId}/diaperRecords/{recordId}
workspaces/{workspaceId}/babies/{babyId}/symptomRecords/{recordId}
workspaces/{workspaceId}/babies/{babyId}/medications/{recordId}
workspaces/{workspaceId}/babies/{babyId}/medicationLogs/{recordId}
workspaces/{workspaceId}/babies/{babyId}/allergies/{recordId}
workspaces/{workspaceId}/babies/{babyId}/milestones/{recordId}
workspaces/{workspaceId}/babies/{babyId}/teethingRecords/{recordId}
workspaces/{workspaceId}/babies/{babyId}/reminders/{recordId}
```

Mỗi hồ sơ/bản ghi có metadata:

```javascript
{
  createdByUid: "...",
  createdByEmail: "...",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  isDeleted: false,
  deletedAt: null,
  deletedByUid: null,
  deletedByEmail: null
}
```

## 4. Luồng Authentication và Authorization

```text
Mở website
   ↓
Kiểm tra Firebase Web Config
   ↓
Google Sign-In
   ↓
Tạo/cập nhật users/{uid}
   ↓
Nhận lời mời đang chờ theo email
   ↓
Query collectionGroup("members") với uid hiện tại
   ↓
Đọc từng workspace hợp lệ
   ↓
Chọn workspace gần nhất hoặc workspace đầu tiên
   ↓
Bắt đầu listener babies trong workspace
   ↓
Render Dashboard
```

Dashboard không hiển thị dữ liệu sức khỏe trước khi membership được xác nhận.

### Tương thích dữ liệu MVP cũ

Phiên bản cũ dùng:

```text
allowedUsers/{email}
babies/{babyId}
```

Phiên bản mới giữ quyền đọc có giới hạn để migration:

- Admin legacy đăng nhập đầu tiên sẽ tạo workspace `family-default`.
- Member legacy đăng nhập sau sẽ nhận membership trong workspace này.
- Admin mở **Cài đặt → Chuyển dữ liệu MVP cũ vào workspace**.
- Migration chỉ sao chép và giữ nguyên document ID; không xóa dữ liệu nguồn.

## 5. Soft delete

### Xóa mềm

Khi người dùng bấm Xóa:

```javascript
{
  isDeleted: true,
  deletedAt: serverTimestamp(),
  deletedByUid: currentUser.uid,
  deletedByEmail: currentUser.email,
  updatedAt: serverTimestamp()
}
```

Tất cả query chính có:

```javascript
where("isDeleted", "==", false)
```

### Khôi phục

Khôi phục đặt lại:

```javascript
{
  isDeleted: false,
  deletedAt: null,
  deletedByUid: null,
  deletedByEmail: null,
  updatedAt: serverTimestamp()
}
```

### Xóa vĩnh viễn

- Chỉ admin.
- Document phải đang ở trạng thái xóa mềm.
- Với hồ sơ bé, app đọc từng subcollection bằng pagination, dừng nếu một nhóm vượt 10.000 bản ghi, xóa các document con theo batch, dọn ảnh Storage rồi xóa document cha.
- Storage cleanup lỗi không làm mất hồ sơ Firestore chưa được purge; lỗi được ghi console để xử lý file mồ côi.

## 6. Phân trang bằng `startAfter`

`js/firestore-service.js` cung cấp:

- `getCollectionPage()` — tải một trang, thêm một document để xác định `hasMore`.
- `getAllPagesResult()` — đọc tuần tự qua cursor, trả `{ items, truncated, lastDocument }`.
- `getAllPages()` — wrapper chỉ trả `items`.

Mẫu query:

```javascript
query(
  collectionRef,
  where("isDeleted", "==", false),
  orderBy("measuredAt", "desc"),
  startAfter(lastDocument),
  limit(21)
)
```

UI mặc định 20 bản ghi/trang. Ô tìm kiếm text lọc trong trang hiện tại; date/status được đưa vào Firestore query.

## 7. JSON backup schema v2

### Export

```javascript
{
  schemaVersion: 2,
  app: "Baby Tracker",
  exportedAt: "2026-07-13T...Z",
  workspace: { id: "...", name: "..." },
  baby: { ... },
  collections: {
    growthRecords: [],
    vaccinations: [],
    ...
  }
}
```

Backup chỉ chứa dữ liệu đang hoạt động. File ảnh trong Storage không nằm trong JSON.

### Import

Chỉ menu admin hiển thị nút import và `importBackupAsNewBaby()` tự kiểm tra role lần nữa.

Validation gồm:

- `schemaVersion === 2`.
- Tối đa 10 MB và 10.000 bản ghi.
- Chỉ 13 collection được hỗ trợ.
- Chỉ field được whitelist.
- ID nguồn phải có và không trùng trong cùng collection.
- Timestamp/date hợp lệ.
- Enum hợp lệ.
- Range số hợp lý.
- End time không trước start time.
- URL chỉ `http`/`https`.
- Liên kết thuốc/nhắc việc được kiểm tra và remap.
- Firebase Storage URL cũ bị loại bỏ.

Import tạo một hồ sơ mới có hậu tố “(khôi phục)”. Nếu một batch sau bị lỗi, app soft-delete hồ sơ tạm, purge các document đã commit và xóa hồ sơ tạm. Nếu rollback cũng lỗi, UI trả về baby ID để admin kiểm tra Thùng rác.

> Vì ứng dụng không có backend, Security Rules không thể phân biệt “bulk import” với nhiều thao tác CRUD bình thường. Quyền import được kiểm tra ở UI và function; mọi document vẫn phải vượt qua schema/rules như CRUD thông thường.

## 8. Cloud Storage cho ảnh

### Đường dẫn

```text
workspaces/{workspaceId}/babies/{babyId}/images/avatar/{timestamp-uuid.ext}
workspaces/{workspaceId}/babies/{babyId}/images/milestones/{recordId}/{timestamp-uuid.ext}
```

Metadata upload:

```javascript
{
  contentType: file.type,
  customMetadata: {
    workspaceId,
    babyId,
    uploadedByUid
  }
}
```

### Chính sách

- `viewer`: đọc ảnh.
- `admin/member`: đọc, upload và delete ảnh trong workspace.
- Tối đa 5 MB.
- Chỉ `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
- Không cho update metadata/file tại cùng path; ảnh mới dùng filename mới.

### Lưu ý billing hiện hành

Cloud Storage for Firebase hiện yêu cầu project ở **Blaze plan**. Blaze là pay-as-you-go; vẫn có thể có mức miễn phí tùy location và usage. Hãy bật budget alerts trước khi dùng dữ liệu thật.

Tài liệu chính thức:

- https://firebase.google.com/docs/storage/web/start
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

## 9. WHO Growth Standards

File dữ liệu:

```text
assets/data/who-growth-standards-v1.json
```

Bao gồm 1.857 dòng LMS cho mỗi tổ hợp:

- Weight-for-age — girls/boys.
- Length/height-for-age — girls/boys.
- Head circumference-for-age — girls/boys.
- Ngày tuổi 0–1.856.

### Cách tính

Trong vùng chuẩn LMS:

```text
Z = ((X / M)^L - 1) / (L × S), nếu L ≠ 0
Z = ln(X / M) / S, nếu L = 0
```

Ngoài ±3 SD, app dùng restricted LMS tail theo khoảng cách giữa 2 SD và 3 SD. Percentile chỉ hiển thị khi `|Z| <= 3`; ngoài vùng này app hiển thị z-score nhưng không chuyển thành percentile để tránh cảm giác chính xác giả.

### Giới hạn diễn giải

- Chỉ áp dụng khi hồ sơ có giới tính `male` hoặc `female`.
- Dùng tuổi hoàn thành theo ngày, không tự hiệu chỉnh tuổi cho trẻ sinh non.
- Dưới 24 tháng WHO thường dùng chiều dài nằm; từ 24 tháng dùng chiều cao đứng. App không thể xác minh kỹ thuật đo.
- Không tự kết luận bệnh lý.
- WHO standard chỉ là một phần của đánh giá lâm sàng.

Nguồn chính thức:

- https://www.who.int/tools/child-growth-standards/standards
- https://www.who.int/tools/child-growth-standards/standards/weight-for-age
- https://www.who.int/tools/child-growth-standards/standards/length-height-for-age
- https://www.who.int/tools/child-growth-standards/standards/head-circumference-for-age
- https://www.who.int/tools/child-growth-standards/software

## 10. Cấu trúc thư mục

```text
baby-tracker/
├── index.html
├── README.md
├── UPDATE-INSTRUCTIONS.md
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
├── .nojekyll
├── assets/
│   ├── data/
│   │   └── who-growth-standards-v1.json
│   ├── icons/
│   └── images/
│       └── baby-placeholder.svg
├── css/
│   ├── variables.css
│   ├── reset.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   ├── forms.css
│   ├── utilities.css
│   └── responsive.css
└── js/
    ├── app.js
    ├── app-state.js
    ├── auth.js
    ├── authorization.js
    ├── backup-service.js
    ├── firebase-config.js
    ├── firebase-service.js
    ├── firestore-service.js
    ├── storage-service.js
    ├── workspace-service.js
    ├── migration-service.js
    ├── who-growth.js
    └── modules/
        ├── module-factory.js
        ├── dashboard.js
        ├── babies.js
        ├── growth.js
        ├── allowed-users.js
        ├── reports.js
        └── ...
```

## 11. Thiết lập Firebase từ đầu

### Bước 1 — Firebase project và Web App

1. Mở Firebase Console.
2. Tạo project.
3. Project Overview → biểu tượng Web.
4. App nickname: `Baby Tracker Web`.
5. Không cần Firebase Hosting vì website dùng GitHub Pages.
6. Sao chép Web Config vào `js/firebase-config.js`.
7. Kiểm tra `storageBucket` đúng bucket thật của project.

Không thêm service account, private key hoặc Admin SDK credential vào repository.

### Bước 2 — Google Authentication

1. Build → Authentication → Get started.
2. Sign-in method/Providers → Google.
3. Enable.
4. Chọn support email.
5. Save.
6. Settings → Authorized domains.
7. Thêm `localhost` và `YOUR_USERNAME.github.io`.

Chỉ nhập hostname, không nhập `https://` hoặc `/baby-tracker/`.

### Bước 3 — Firestore

1. Build → Firestore Database → Create database.
2. Chọn Standard/Firebase-native, không MongoDB compatibility.
3. Chọn Production mode.
4. Chọn location phù hợp.
5. Không cần tạo `allowedUsers` nếu đây là project mới hoàn toàn.

Workspace đầu tiên được tạo từ màn hình Cài đặt sau khi tài khoản có quyền bootstrap. Với project nâng cấp từ phiên bản cũ, giữ `allowedUsers/{email-admin}` để admin legacy khởi tạo `family-default`.

### Bước 4 — Publish Firestore Rules

Cách Console:

1. Firestore Database → Rules.
2. Dán toàn bộ `firestore.rules`.
3. Publish.

Cách CLI:

```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

### Bước 5 — Deploy indexes

```bash
firebase deploy --only firestore:indexes
```

Hoặc tạo từng index qua link lỗi Firebase Console. Chờ trạng thái **Enabled** trước khi test.

### Bước 6 — Bật Cloud Storage

1. Nâng project lên Blaze plan và thiết lập budget alerts.
2. Databases & Storage → Storage → Get started.
3. Chọn location và tạo default bucket.
4. Đảm bảo `firebaseConfig.storageBucket` khớp tên bucket.
5. Storage → Rules → dán `storage.rules` → Publish.

CLI:

```bash
firebase deploy --only storage
```

Storage Rules dùng Firestore membership. Lần đầu publish rules có `firestore.get()`/`firestore.exists()`, Firebase có thể yêu cầu bật quyền kết nối giữa Storage Rules và default Firestore database.

### Bước 7 — Deploy toàn bộ Rules và indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

`firebase.json` đã trỏ đúng các file.

## 12. Nâng cấp từ repository cũ

Đọc chi tiết trong [UPDATE-INSTRUCTIONS.md](./UPDATE-INSTRUCTIONS.md).

Thứ tự bắt buộc:

1. Backup Firestore hiện tại.
2. Upload toàn bộ source mới.
3. Publish Firestore Rules mới.
4. Deploy indexes mới.
5. Bật Storage/Blaze và publish Storage Rules nếu dùng upload ảnh.
6. Admin legacy đăng nhập trước.
7. Cài đặt → Migration dữ liệu cũ.
8. So sánh dữ liệu cũ/mới.
9. Chỉ sau khi xác nhận mới lập kế hoạch xóa dữ liệu global cũ.

## 13. Chạy local

Không mở bằng `file:///` vì ES Modules và `fetch()` WHO dataset cần HTTP server.

### VS Code Live Server

1. Mở folder repository.
2. Cài Live Server.
3. Chuột phải `index.html` → Open with Live Server.
4. Thêm `localhost` vào Authorized Domains.

### Python

```bash
python -m http.server 5500
```

Mở:

```text
http://localhost:5500
```

## 14. GitHub Pages

1. Upload nguyên cấu trúc thư mục, không làm phẳng file.
2. `index.html` nằm ở root.
3. Repository → Settings → Pages.
4. Deploy from a branch.
5. Branch `main`, folder `/(root)`.
6. Thêm `USERNAME.github.io` vào Firebase Authorized Domains.
7. `Ctrl + Shift + R` sau deployment.

## 15. Dữ liệu demo

Admin mở:

```text
Cài đặt → Công cụ admin → Tạo/hoàn thiện dữ liệu demo
```

Ứng dụng tạo:

- Hồ sơ demo cơ bản.
- Hồ sơ demo đầy đủ với tất cả 13 subcollection.
- Không tạo lại hồ sơ đã có marker demo.
- Batch demo hiện dưới 450 thao tác nên commit atomically.

## 16. Kiểm thử

### Authentication và workspace

- [ ] User không có membership bị sign out.
- [ ] Invite đúng email được claim.
- [ ] Một user chuyển được giữa nhiều workspace.
- [ ] Dữ liệu workspace A không xuất hiện ở workspace B.
- [ ] Viewer không thể ghi bằng UI và Rules.
- [ ] Member không quản lý membership.
- [ ] Admin không tự khóa/hạ role.
- [ ] Owner không bị khóa/hạ role/xóa membership.

### Soft delete

- [ ] Xóa chuyển bản ghi vào Thùng rác.
- [ ] Query chính không thấy bản ghi đã xóa.
- [ ] Khôi phục trả bản ghi về danh sách.
- [ ] Member không thấy nút xóa vĩnh viễn.
- [ ] Rules từ chối hard delete document chưa soft-delete.
- [ ] Purge hồ sơ xóa subcollections và ảnh.

### Storage

- [ ] JPG/PNG/WebP/GIF dưới 5 MB upload được.
- [ ] PDF hoặc file >5 MB bị từ chối ở client và Rules.
- [ ] Viewer chỉ đọc.
- [ ] User workspace khác không đọc ảnh.
- [ ] Thay ảnh dọn ảnh cũ.
- [ ] Lỗi Firestore sau upload dọn ảnh mới.

### Pagination

- [ ] Trang 1/2 không lặp document.
- [ ] Trang trước dùng cache trang đã tải.
- [ ] Đổi date/status reset cursor.
- [ ] Thùng rác có cursor riêng.
- [ ] Backup đọc đủ nhiều trang.

### Backup/import

- [ ] JSON v2 hợp lệ import thành hồ sơ mới.
- [ ] Schema khác v2 bị từ chối.
- [ ] Field/collection lạ không được ghi.
- [ ] ID nguồn trùng bị từ chối.
- [ ] Ngày 31/02 bị từ chối.
- [ ] Member/viewer không thấy và không chạy được import function.
- [ ] Liên kết medication log/reminder được remap.
- [ ] Giả lập lỗi batch sau và kiểm tra rollback.

### WHO

- [ ] Median LMS cho z-score gần 0.
- [ ] Nam/nữ dùng đúng bảng.
- [ ] Tuổi ngoài 0–1.856 ngày không tính.
- [ ] Hồ sơ `other` không tính.
- [ ] Không hiển thị percentile ngoài ±3 SD.
- [ ] Chart không tăng chiều cao/re-render vô hạn.

## 17. Kiểm tra mã nguồn đã chạy

Trong quá trình tạo bản này đã thực hiện:

- `node --check` cho toàn bộ 40 file JavaScript.
- Kiểm tra tất cả relative imports tồn tại.
- Xác nhận mọi Firebase import dùng duy nhất SDK 12.16.0.
- Bundle smoke test bằng esbuild.
- JSON validation cho indexes và WHO dataset.
- Test round-trip LMS/z-score và integrity 6 × 1.857 dòng WHO.
- Test backup schema với payload hợp lệ, ngày sai, ID trùng, field lạ và dangling reference.
- Parse/lint `firestore.rules` và `storage.rules` bằng parser chính thức trong `@firebase/eslint-plugin-security-rules`.

Rules vẫn nên được test bằng Firebase Emulator Suite hoặc Rules Playground trên project của bạn trước khi dùng dữ liệu thật.

## 18. Bảo mật và giới hạn

- GitHub Pages là static hosting; source JavaScript có thể được xem.
- Firebase Web Config không phải private key.
- Firestore Rules và Storage Rules là lớp bảo vệ server-side chính.
- App không mã hóa field-level ngoài mã hóa mặc định của dịch vụ Firebase.
- Download URL của Storage là bearer URL dài; không chia sẻ URL ra ngoài. Rules bảo vệ SDK read, nhưng người có download token URL có thể truy cập file cho đến khi token bị thu hồi/thay đổi.
- Import JSON không chứa file ảnh.
- Xóa vĩnh viễn không thể khôi phục nếu không có backup.
- WHO không xử lý hiệu chỉnh tuổi sinh non hoặc xác minh cách đo.
- Reminder vẫn chỉ hiển thị khi website được mở; không có server-side push notification.
- Dữ liệu sức khỏe trẻ em là dữ liệu nhạy cảm: giới hạn membership, review quyền định kỳ và backup an toàn.

## 19. Lỗi thường gặp

### `permission-denied`

Kiểm tra:

- Membership document đúng UID.
- `active == true`.
- Role hợp lệ.
- Workspace `active == true`.
- Rules mới đã publish.
- Query có `isDeleted` và index tương ứng.

### `failed-precondition` / missing index

- Mở link Firebase trong console.
- Hoặc deploy `firestore.indexes.json`.
- Chờ index Enabled.

### Storage 402/403

- Project chưa ở Blaze plan.
- Bucket chưa được tạo.
- `storageBucket` sai.
- Storage Rules chưa publish.
- Membership không hợp lệ.

### Ảnh upload được nhưng hồ sơ không lưu

Ứng dụng cố dọn file vừa upload. Kiểm tra console nếu cleanup cũng thất bại, sau đó xóa file mồ côi trong Storage Console.

### WHO dataset 404

- Kiểm tra `assets/data/who-growth-standards-v1.json` đã upload.
- Không mở app bằng `file:///`.
- Kiểm tra GitHub phân biệt chữ hoa/chữ thường.

### Migration không thấy dữ liệu cũ

- Tài khoản admin cần còn trong `allowedUsers/{email}` legacy.
- Rules phải giữ block legacy read-only.
- Dữ liệu cũ phải nằm ở root `babies/{babyId}`.

## 20. Nguồn chính thức

Firebase:

- Query cursors: https://firebase.google.com/docs/firestore/query-data/query-cursors
- Storage web: https://firebase.google.com/docs/storage/web/start
- Upload files: https://firebase.google.com/docs/storage/web/upload-files
- Storage Rules conditions: https://firebase.google.com/docs/storage/security/rules-conditions

WHO:

- Child Growth Standards: https://www.who.int/tools/child-growth-standards/standards
- Weight-for-age: https://www.who.int/tools/child-growth-standards/standards/weight-for-age
- Length/height-for-age: https://www.who.int/tools/child-growth-standards/standards/length-height-for-age
- Head circumference-for-age: https://www.who.int/tools/child-growth-standards/standards/head-circumference-for-age
- WHO software/methodology: https://www.who.int/tools/child-growth-standards/software
