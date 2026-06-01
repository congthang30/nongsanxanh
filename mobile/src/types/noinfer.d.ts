/**
 * Polyfill cho `NoInfer<T>` — intrinsic duoc them tu TypeScript 5.4.
 *
 * Du an dang ghim `typescript ~5.3.3` (theo Expo SDK 52), nhung
 * `@tanstack/react-query@5.x` dung `NoInfer` trong type defs cua no.
 * Voi `skipLibCheck`, cac tham chieu `NoInfer` khong resolve duoc se am tham
 * lam sup generic cua `useQuery`/`useMutation` thanh `any`, gay loi
 * "implicitly has an 'any' type" lan rong khap app.
 *
 * `NoInfer<T>` chi anh huong toi viec suy luan kieu (inference), khong thay doi
 * tinh tuong thich gan tri — nen alias `= T` la dung ve mat ngu nghia.
 *
 * TODO: Khi nang TypeScript len >= 5.4, XOA file nay (intrinsic se co san,
 * va khai bao trung se gay loi).
 */
declare type NoInfer<T> = T;
