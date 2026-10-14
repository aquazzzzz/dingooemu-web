export const messages:Record<string,readonly [string,string]> = {
  '通过连接码、已记住的主机或双方互扫二维码连接。':['Connect using a code, a remembered host, or QR codes.','接続コード、記憶したホスト、またはQRコードで接続します。'],
  '生成二维码':['Generate QR code','QRコードを生成'],
  '扫描二维码':['Scan QR code','QRコードを読み取る'],
  '扫描回复':['Scan reply','返信を読み取る'],
  '双方互扫二维码配对，无需复制连接文本。':['Scan each other’s QR codes to pair.','双方のQRコードを読み取って接続します。'],
  '暂停轮播':['Pause rotation','切り替えを停止'],
  '继续轮播':['Resume rotation','切り替えを再開'],
  '下一张':['Next code','次のコード'],
  '保存图片':['Save image','画像を保存'],
  '取消配对':['Cancel pairing','接続をキャンセル'],
  '启用摄像头':['Enable camera','カメラを有効にする'],
  '切换摄像头':['Switch camera','カメラを切り替える'],
  '读取图片':['Read images','画像を読み取る'],
  '取消扫描':['Cancel scanning','読み取りをキャンセル'],
  '摄像头预览':['Camera preview','カメラのプレビュー'],
  '配对二维码':['Pairing QR code','接続用QRコード'],
  '正在生成二维码…':['Generating QR code…','QRコードを生成中…'],
  '回复二维码':['Reply QR code','返信QRコード'],
  '主机连接二维码':['Host connection QR code','ホスト接続QRコード'],
  '请让主机扫描此回复二维码，等待连接。':['Have the host scan this reply QR code, then wait for connection.','ホストでこの返信QRコードを読み取り、接続を待ってください。'],
  '请让接收端扫描，再扫描对方的回复二维码。':['Have the receiver scan this code, then scan its reply QR code.','受信側で読み取り、その返信QRコードを読み取ってください。'],
  '第 {0} / {1} 张':['Code {0} / {1}','{0} / {1} 枚目'],
  '已读取 {0} / {1} 张':['Read {0} / {1} codes','{0} / {1} 枚を読み取り済み'],
  '请对准二维码；轮播时保持对准，直到全部读取。':['Point at the QR code. Keep aiming until all rotating codes are read.','QRコードに向け、すべてのコードが読み取られるまで保持してください。'],
  '此地址无法使用摄像头，请使用 HTTPS、localhost 或读取二维码图片。':['Camera unavailable at this address. Use HTTPS, localhost, or read QR images.','このアドレスではカメラを使えません。HTTPS、localhost、またはQR画像を利用してください。'],
  '摄像头无法启用：{0}。也可以读取二维码图片。':['Cannot enable camera: {0}. You can read QR images instead.','カメラを起動できません：{0}。QR画像も読み取れます。'],
  '图片过大，请使用二维码截图。':['Image too large. Use a QR code screenshot.','画像が大きすぎます。QRコードのスクリーンショットを使ってください。'],
  '未找到二维码，请选择清晰的二维码图片。':['No QR code found. Select a clear QR image.','QRコードが見つかりません。鮮明なQR画像を選んでください。'],
  '二维码无效或已损坏，请重新扫描。':['Invalid or damaged QR code. Scan again.','QRコードが無効または破損しています。再度読み取ってください。'],
  '这是主机连接二维码，请扫描接收端的回复二维码。':['This is the host QR code. Scan the receiver’s reply QR code.','これはホストのQRコードです。受信側の返信QRコードを読み取ってください。'],
  '这是另一次配对的二维码，请扫描本次回复。':['This QR code belongs to another pairing. Scan the current reply.','別の接続のQRコードです。今回の返信を読み取ってください。'],
  '这是回复二维码，请先扫描主机的连接二维码。':['This is a reply QR code. Scan the host’s connection code first.','これは返信QRコードです。先にホストの接続QRコードを読み取ってください。'],
  '二维码来自不同的配对，请取消扫描后重试。':['These codes belong to different pairings. Cancel scanning and retry.','異なる接続のQRコードです。読み取りをキャンセルして再試行してください。'],
  '浏览器不支持此二维码，请更新浏览器或使用文本配对。':['This browser cannot read this QR code. Update it or use text pairing.','このブラウザは対応していません。更新するかテキストで接続してください。'],
  '二维码配对未完成，请查看串流状态后重试。':['QR pairing failed. Check stream status and retry.','QR接続が完了しませんでした。配信状態を確認して再試行してください。'],
  '请先结束当前会话，再扫描主机二维码。':['End the current session before scanning the host QR code.','現在のセッションを終了してからホストQRコードを読み取ってください。'],
  '等待接收端扫描并返回回复二维码…':['Waiting for the receiver to scan and generate a reply QR code…','受信側の読み取りと返信QRコードの生成を待っています…'],
  '正在连接串流…':['Connecting stream…','配信に接続中…'],
  '连接码与记忆连接需要配对服务；可使用下方二维码或高级选项中的文本配对。':['Codes and remembered connections require a pairing service. Use QR codes below or text pairing in advanced options.','接続コードと記憶した接続には接続サービスが必要です。下のQRコード、または詳細設定のテキスト接続を利用してください。'],
  "生成连接码": ["Generate connection code", "接続コードを生成"],
  "连接主机": ["Connect", "ホストに接続"],
  "配对": ["Pair", "ペアリング"],
  "手柄来源": ["Controller", "コントローラー"],
  "RetroArch 原生手柄": ["RetroArch controller", "RetroArch パッド"],
  "网页手柄": ["Web controller", "ウェブパッド"],
  "正在载入游戏，串流将在载入后继续…": ["Loading the game; streaming will resume when ready…", "ゲームを読み込み中。完了後に配信を再開します…"],
  "游戏载入或串流恢复失败：{0}": ["Game loading or stream recovery failed: {0}", "ゲームの読み込みまたは配信の再開に失敗しました：{0}"],
  "串流媒体不完整，请重新连接。": ["Stream media is incomplete. Reconnect.", "配信メディアが不足しています。再接続してください。"],
  "短码无效或已过期，请在主机生成新短码。": ["The code is invalid or expired. Generate a new one on the host.", "コードが無効または期限切れです。ホストで新しく生成してください。"],
  "主机网页尚未打开，请先在主机打开游戏页面。": ["Open the game page on the host first.", "先にホストでゲームページを開いてください。"],
  "正在处理接收端的连接请求…": ["Processing the receiver's connection request…", "受信側の接続要求を処理中…"],
  "快捷连接已开启，等待接收端连接。": ["Quick connection enabled. Waiting for the receiver.", "クイック接続が有効です。受信側の接続を待っています。"],
  "请在本机运行游戏或打开 RetroArch，再接收连接。": ["Run a game or open RetroArch on this device to accept a connection.", "この端末でゲームまたはRetroArchを開いてから接続を受け付けてください。"],
  "请在主机确认设备 {0}，允许并记住。": ["On the host, approve and remember device {0}.", "ホストで端末 {0} を確認して承認・登録してください。"],
  "主机生成短码，另一台设备输入并记住。首次确认后，再点“连接已记住的主机”即可。": ["Generate a code on the host and enter it on the other device. After approval, use Connect to remembered host.", "ホストでコードを生成し、相手の端末で入力して登録します。承認後は「登録済みホストに接続」を使えます。"],
  "本机可生成主机短码，也可输入另一台设备的短码。": ["This device can generate a host code or enter another device's code.", "この端末でホストのコードを生成することも、別の端末のコードを入力することもできます。"],
  "打开主机 RetroArch": ["Open host RetroArch", "ホストのRetroArchを開く"],
  "暂停主机": ["Pause host", "ホストを一時停止"],
  "继续主机": ["Resume host", "ホストを再開"],
  "本机角色：主机": ["This device: host", "この端末：ホスト"],
  "本机角色：接收端": ["This device: receiver", "この端末：受信側"],
  "本机角色：尚未选择": ["This device: role not selected", "この端末：役割未選択"],
  "快捷连接": ["Quick connection", "クイック接続"],
  "首次输入主机的 6 位短码，电脑确认后记住设备。以后手机点击“连接已记住的主机”，无需交换长文本。": ["Enter the host's 6-digit code once and approve the device on the computer. Next time, choose Connect to remembered host.", "初回はホストの6桁コードを入力し、PCで端末を承認します。次回からは「登録済みホストに接続」を押してください。"],
  "开启快捷连接": ["Enable quick connection", "クイック接続を有効化"],
  "生成新短码": ["Generate a new code", "新しいコードを生成"],
  "连接已记住的主机": ["Connect to remembered host", "登録済みホストに接続"],
  "忘记快捷连接": ["Forget quick connection", "接続登録を削除"],
  "主机短码": ["Host code", "ホストのコード"],
  "输入连接码": ["Enter connection code", "接続コードを入力"],
  "记住这台主机": ["Remember this host", "このホストを登録"],
  "浏览器未允许记住设备；关闭页面后需重新配对。": ["The browser cannot save this device. Pair again after closing the page.", "ブラウザーに端末を保存できません。ページを閉じた後は再登録が必要です。"],
  "先在电脑开启快捷连接，再在手机输入短码。": ["Enable quick connection on the computer, then enter its code on the phone.", "PCでクイック接続を有効にして、スマホでコードを入力してください。"],
  "快捷连接需要新版局域网服务器；仍可使用下方的手动配对。": ["Quick connection requires the updated LAN server. Manual pairing below remains available.", "クイック接続には新版のLANサーバーが必要です。下の手動ペアリングも利用できます。"],
  "快捷连接已忘记。": ["Quick connection forgotten.", "接続登録を削除しました。"],
  "短码无效或已过期，请在电脑生成新短码。": ["The code is invalid or expired. Generate a new one on the computer.", "コードが無効または期限切れです。PCで新しく生成してください。"],
  "尝试次数过多，请稍后再试。": ["Too many attempts. Try again later.", "試行回数が多すぎます。しばらくしてから再試行してください。"],
  "主机网页尚未打开，请先在电脑打开游戏页面。": ["Open the host game page on the computer first.", "先にPCでゲームページを開いてください。"],
  "主机已有串流，请先停止旧连接。": ["The host already has a stream. Stop the previous connection first.", "ホストは配信中です。先に前の接続を停止してください。"],
  "设备授权已失效，请重新配对。": ["Device authorization expired or was revoked. Pair again.", "端末の承認が無効になりました。再登録してください。"],
  "已记住的设备已达上限，请先移除不用的设备。": ["The remembered device limit was reached. Remove unused devices first.", "登録端末数の上限に達しました。不要な端末を削除してください。"],
  "快捷连接暂不可用，请检查局域网服务器。": ["Quick connection is unavailable. Check the LAN server.", "クイック接続を利用できません。LANサーバーを確認してください。"],
  "主机短码：{0}（10 分钟内有效）": ["Host code: {0} (valid for 10 minutes)", "ホストのコード：{0}（10分間有効）"],
  "短码已使用或过期，可生成新短码。": ["The code was used or expired. Generate a new one.", "コードは使用済みまたは期限切れです。新しく生成してください。"],
  "已记住设备 {0}": ["Remembered device {0}", "登録済み端末 {0}"],
  "待确认设备 {0}": ["Device {0} awaiting approval", "承認待ち端末 {0}"],
  "允许并记住": ["Approve and remember", "承認して登録"],
  "移除设备": ["Remove device", "端末を削除"],
  "正在处理手机的连接请求…": ["Processing the phone's connection request…", "スマホの接続要求を処理中…"],
  "快捷连接已开启，等待手机连接。": ["Quick connection enabled. Waiting for the phone.", "クイック接続が有効です。スマホの接続を待っています。"],
  "设备已记住，请在电脑运行游戏或打开 RetroArch 后连接。": ["Device remembered. Run a game or open RetroArch on the computer before connecting.", "端末を登録しました。PCでゲームまたはRetroArchを開いてから接続してください。"],
  "已通过快捷连接配对。": ["Paired through quick connection.", "クイック接続でペアリングしました。"],
  "主机已记住，点击连接即可开始串流。": ["Host remembered. Choose Connect to start streaming.", "ホストを登録しました。接続を押すと配信を開始します。"],
  "请在电脑确认设备 {0}，允许并记住。": ["On the computer, approve and remember device {0}.", "PCで端末 {0} を確認して承認・登録してください。"],
  "打开电脑 RetroArch": ["Open host RetroArch", "PCのRetroArchを開く"],
  "返回串流游戏": ["Return to streamed game", "配信ゲームに戻る"],
  "查看连接诊断": ["Show connection diagnostics", "接続診断を表示"],
  "串流诊断": ["Stream diagnostics", "配信診断"],
  "复制主机连接文本": ["Copy host connection text", "ホストの接続テキストをコピー"],
  "复制接收端回复": ["Copy receiver reply", "受信側の応答をコピー"],
  "接收端回复已复制，请发回主机。": ["Receiver reply copied. Send it back to the host.", "受信側の応答をコピーしました。ホストに返してください。"],
  "主机连接文本已复制，请发给接收端。": ["Host connection text copied. Send it to the receiver.", "ホストの接続テキストをコピーしました。受信側に渡してください。"],
  "尚未复制到剪贴板。请长按“接收端回复文本”，选择“全选”→“复制”，再发回主机。": ["Not copied to the clipboard yet. Long-press the receiver reply, choose Select all → Copy, then send it back to the host.", "まだクリップボードにコピーされていません。受信側の応答を長押しし、「すべて選択」→「コピー」を選んでホストに返してください。"],
  "尚未复制到剪贴板。请长按“主机连接文本”，选择“全选”→“复制”，再发给接收端。": ["Not copied to the clipboard yet. Long-press the host connection text, choose Select all → Copy, then send it to the receiver.", "まだクリップボードにコピーされていません。ホストの接続テキストを長押しし、「すべて選択」→「コピー」を選んで受信側に渡してください。"],
  "本次配对：{0}（两端应一致）": ["Pairing: {0} (must match on both devices)", "ペアリング：{0}（両端末で一致する必要があります）"],
  "当前没有等待回复的串流，请先创建串流。": ["No stream is waiting for a reply. Create a stream first.", "応答待ちの配信がありません。先に配信を作成してください。"],
  "这是主机连接文本。请在接收端点击“接收串流”，再把接收端生成的回复粘贴到这里。": ["This is the host connection text. Choose Receive stream on the receiver, then paste its generated reply here.", "これはホストの接続テキストです。受信側で「配信を受信」を押し、生成された応答をここに貼り付けてください。"],
  "这是另一次配对的回复。请把主机当前的连接文本重新发给接收端，再生成新回复。": ["This reply belongs to another pairing. Send the current host connection text to the receiver and generate a new reply.", "別のペアリングの応答です。ホストの現在の接続テキストを受信側に渡し、新しい応答を生成してください。"],
  "回复已经处理，请等待连接，无需再次完成配对。": ["The reply has already been processed. Wait for the connection; there is no need to finish pairing again.", "応答はすでに処理されました。再度ペアリングを完了せず、接続をお待ちください。"],
  "粘贴接收端新生成的回复": ["Paste the newly generated receiver reply", "受信側で生成した新しい応答を貼り付け"],
  "粘贴主机的连接文本": ["Paste the host connection text", "ホストの接続テキストを貼り付け"],
  "主机连接文本：发给接收端": ["Host connection text: send to the receiver", "ホストの接続テキスト：受信側へ"],
  "接收端回复文本：发回主机": ["Receiver reply text: send back to the host", "受信側の応答テキスト：ホストへ"],
  "局域网串流": ["LAN remote play", "LAN ストリーミング"],
  "生成短码让另一台设备连接，或连接已记住的主机。": ["Generate a code for another device, or connect to a remembered host.", "別の端末用のコードを生成するか、記憶済みのホストに接続します。"],
  "发送画面前，可运行游戏或打开本机 RetroArch 菜单。": ["Run a game or open this device's RetroArch menu before sending video.", "映像を送信する前に、ゲームを起動するか、この端末の RetroArch メニューを開いてください。"],
  "打开本机 RetroArch": ["Open local RetroArch", "この端末の RetroArch を開く"],
  "高级选项": ["Advanced options", "詳細オプション"],
  "手动文本配对": ["Manual text pairing", "テキストで手動ペアリング"],
  "串流状态": ["Stream status", "配信状態"],
  "收起信息": ["Collapse info", "情報を閉じる"],
  "展开信息": ["Expand info", "情報を開く"],
  "已获准的设备连接时，可自动启动本机 RetroArch；也可先运行游戏。": ["An approved device can start local RetroArch when connecting. You can also run a game first.", "許可済みの端末が接続すると、この端末の RetroArch を起動できます。先にゲームを起動することもできます。"],
  "正在启动主机 RetroArch…": ["Starting RetroArch on the host…", "ホストの RetroArch を起動中…"],
  "主机页面尚未准备好，请保持页面在前台。": ["The host page is not ready. Keep it in the foreground.", "ホストのページを前面に保ってください。"],
  "正在请求主机准备游戏或启动 RetroArch…": ["Asking the host to prepare the game or start RetroArch…", "ホストにゲームの準備または RetroArch の起動を要求中…"],
  "主机画面已准备好，正在等待接收端回复…": ["Host video is ready. Waiting for the receiver's reply…", "ホストの映像を準備しました。受信側の応答を待っています…"],
  "接收端已回复，正在完成连接…": ["The receiver replied. Completing the connection…", "受信側が応答しました。接続を完了中…"],
  "连接准备已结束，可再次点击连接。": ["Connection preparation ended. You can connect again.", "接続の準備が終了しました。もう一度接続できます。"],
  "主机已允许操作，当前暂不可操作。": ["Control is allowed but temporarily unavailable.", "操作は許可されていますが、現在は一時的に使用できません。"],
  "播放画面": ["Play video", "映像を再生"],
  "点“播放画面”继续播放。": ["Choose Play video to continue playback.", "「映像を再生」を押して再生を続けてください。"],
  "点“启用声音”即可听到游戏声音。": ["Choose Enable audio to hear the game.", "「音声を有効化」を押すとゲームの音声が聞こえます。"],
  "记住并连接": ["Remember and connect", "記憶して接続"],
  "连接记忆": ["Remembered connection", "記憶済みの接続"],
  "忘记本机连接": ["Forget this connection", "この接続を削除"],
  "连接需要局域网服务器；高级选项中可使用手动文本配对。": ["Connection requires the LAN server. Manual text pairing is available in Advanced options.", "接続には LAN サーバーが必要です。詳細オプションでテキストによる手動ペアリングを利用できます。"],
  "本机连接记忆已清除。": ["This device's connection has been forgotten.", "この端末の接続情報を削除しました。"],
  "连接信息已交换。": ["Connection information exchanged.", "接続情報を交換しました。"],
  "正在自动交换连接信息…": ["Exchanging connection information automatically…", "接続情報を自動交換中…"],
  "等待另一台设备连接。": ["Waiting for another device to connect.", "別の端末からの接続を待っています。"],
  "已准备好配对；发送画面前请运行游戏或打开本机 RetroArch。": ["Ready to pair. Run a game or open local RetroArch before sending video.", "ペアリング可能です。映像を送信する前に、ゲームを起動するか、この端末の RetroArch を開いてください。"],
  "主机运行游戏，另一台设备接收画面和声音。两端连接同一局域网，并保持页面在前台。": ["Run the game on the host and receive video and audio on another device. Keep both pages in the foreground on the same LAN.", "ホストでゲームを実行し、別の端末で映像と音声を受信します。両端末を同じ LAN に接続し、ページを前面に保ってください。"],
  "主机先运行游戏，点击“创建串流”，把本机文本发给接收端。": ["On the host, run a game, choose Create stream, and send the connection text to the receiver.", "ホストでゲームを実行し、「配信を作成」を押して接続テキストを受信側に渡します。"],
  "接收端粘贴文本，点击“接收串流”，再把回复发回主机。": ["On the receiver, paste the text, choose Receive stream, and send the reply to the host.", "受信側でテキストを貼り付けて「配信を受信」を押し、応答をホストに返します。"],
  "主机粘贴回复，点击“完成配对”。允许操作后，接收端可使用虚拟手柄和键盘。": ["On the host, paste the reply and finish pairing. Enable remote control to let the receiver use touch controls and a keyboard.", "ホストで応答を貼り付けてペアリングを完了します。操作を許可すると、受信側でタッチ操作とキーボードを使えます。"],
  "创建串流": ["Create stream", "配信を作成"],
  "接收串流": ["Receive stream", "配信を受信"],
  "停止串流": ["Stop stream", "配信を停止"],
  "串流帧率上限": ["Stream frame rate limit", "配信フレームレート上限"],
  "允许接收端操作": ["Allow remote control", "受信側の操作を許可"],
  "播放串流／启用声音": ["Play stream / Enable audio", "配信を再生／音声を有効化"],
  "串流画面": ["Stream video", "配信映像"],
  "连接文本仅交给预期接收端。断线后自动松开按键；访客 Wi-Fi、设备隔离或浏览器局域网权限可能阻止连接。Safari／iPhone 仍需实机验证。": ["Share connection text only with your intended receiver. Buttons release on disconnect. Guest Wi-Fi, client isolation, or browser LAN permissions may block connections. Safari / iPhone still need device testing.", "接続テキストは受信相手だけに渡してください。切断時はキーを自動解除します。ゲスト Wi-Fi、端末間隔離、LAN 権限により接続できない場合があります。Safari／iPhone は実機検証が必要です。"],
  "串流连接文本无效，请完整复制。": ["Invalid stream connection text. Copy it in full.", "配信の接続テキストが無効です。全体をコピーしてください。"],
  "串流配对超时，请重新连接。": ["Stream pairing timed out. Please reconnect.", "配信のペアリングがタイムアウトしました。再接続してください。"],
  "串流连接已断开，请重新配对。": ["The stream disconnected. Please pair again.", "配信が切断されました。再度ペアリングしてください。"],
  "串流协议不匹配。": ["Incompatible stream protocol.", "配信プロトコルが一致しません。"],
  "对方已停止串流。": ["The other device stopped streaming.", "相手が配信を停止しました。"],
  "请粘贴主机的串流连接文本。": ["Paste the host stream connection text.", "ホストの配信接続テキストを貼り付けてください。"],
  "请粘贴接收端的本次串流回复。": ["Paste the receiver reply for this stream.", "今回の配信に対する受信側の応答を貼り付けてください。"],
  "串流已停止。": ["Streaming stopped.", "配信を停止しました。"],
  "此运行环境不能作为串流主机，请使用支持 Worker 和 AudioWorklet 的浏览器。": ["This runtime cannot host a stream. Use a browser with Worker and AudioWorklet support.", "この実行環境では配信できません。Worker と AudioWorklet に対応したブラウザーを使ってください。"],
  "串流已经启动。": ["Streaming is already active.", "配信はすでに開始されています。"],
  "请先在主机运行游戏，再创建串流。": ["Run a game on the host before creating a stream.", "ホストでゲームを実行してから配信を作成してください。"],
  "正在生成串流连接文本…": ["Creating stream connection text…", "配信接続テキストを生成中…"],
  "正在自动交换连接信息，无需复制配对文本…": ["Exchanging connection information automatically; no text copying is needed…", "接続情報を自動交換中です。テキストのコピーは不要です…"],
  "浏览器没有提供可用的连接地址，请检查浏览器局域网权限或更换网络后重试。": ["The browser provided no usable connection routes. Check its local network permission or try another network.", "ブラウザーから接続先を取得できませんでした。LAN 権限を確認するか、別のネットワークで再試行してください。"],
  "把本机文本发给接收端，等待回复。": ["Send this text to the receiver and wait for its reply.", "このテキストを受信側に渡し、応答を待ってください。"],
  "请先中止本机游戏，再接收串流。": ["Stop the local game before receiving a stream.", "ローカルのゲームを中止してから配信を受信してください。"],
  "把本机回复文本发回主机，等待完成配对。": ["Send this reply to the host to finish pairing.", "この応答をホストに返し、ペアリングの完了を待ってください。"],
  "正在连接串流，请保持双方页面在前台…": ["Connecting stream. Keep both pages in the foreground…", "配信に接続中です。両方のページを前面に保ってください…"],
  "接收端可以操作；主机可随时收回控制权。": ["The receiver can control the game. The host can revoke control at any time.", "受信側が操作できます。ホストはいつでも操作権限を解除できます。"],
  "接收端仅观看。": ["The receiver is viewing only.", "受信側は視聴のみです。"],
  "串流已连接": ["Stream connected", "配信に接続しました"],
  "串流": ["Stream", "配信"],
  "点击“播放串流／启用声音”开始播放。": ["Choose Play stream / Enable audio to start playback.", "「配信を再生／音声を有効化」を押して再生してください。"],
  "主机已允许操作。": ["The host enabled remote control.", "ホストが操作を許可しました。"],
  "仅观看，等待主机允许操作。": ["Viewing only. Waiting for the host to enable control.", "視聴のみです。ホストの操作許可を待っています。"],
  "无法播放串流，请重试或更换浏览器。": ["Cannot play the stream. Retry or use another browser.", "配信を再生できません。再試行するか、別のブラウザーを使ってください。"],
  "视频：{0} × {1} · {2} FPS · 网络往返：{3} ms": ["Video: {0} × {1} · {2} FPS · Network RTT: {3} ms", "映像：{0} × {1} · {2} FPS · ネットワーク往復：{3} ms"],
  "设备互传": ["Device transfer", "デバイス間転送"],
  "两台设备连接同一局域网，保持页面在前台。文件直接传到对方，不上传服务器。": ["Connect both devices to the same local network and keep both pages open in the foreground. Files go directly to the other device, without server uploads.", "両方の端末を同じ LAN に接続し、ページを前面に保ってください。ファイルはサーバーを介さず相手に直接送信します。"],
  "设备 A 点击“创建连接”，把本机连接文本完整复制给设备 B。": ["On device A, choose Create connection and send the complete connection text to device B.", "端末 A で「接続を作成」を押し、接続テキスト全体を端末 B に渡します。"],
  "设备 B 粘贴文本，点击“加入连接”，再把生成的回复文本发回 A。": ["On device B, paste the text, choose Join connection, then send the generated reply text back to A.", "端末 B でテキストを貼り付けて「接続に参加」を押し、生成された応答テキストを A に返します。"],
  "设备 A 粘贴回复，点击“完成配对”。连接后双方均可发送文件。": ["On device A, paste the reply and choose Finish pairing. Either device can then send files.", "端末 A で応答を貼り付けて「ペアリングを完了」を押します。接続後は双方向に送信できます。"],
  "连接文本较长，包含本次配对信息，请仅交给接收方。无需账号、短码服务或云存储。": ["The long connection text contains session pairing information. Share it only with your recipient. No account, short-code service, or cloud storage is needed.", "長い接続テキストには今回の接続情報が含まれます。受信者だけに渡してください。アカウントや短縮コードサービス、クラウド保存は不要です。"],
  "创建连接": ["Create connection", "接続を作成"],
  "加入连接": ["Join connection", "接続に参加"],
  "完成配对": ["Finish pairing", "ペアリングを完了"],
  "断开／取消传输": ["Disconnect / cancel transfer", "切断／転送を中止"],
  "粘贴对方的连接／回复文本": ["Paste the other device’s connection / reply text", "相手の接続／応答テキストを貼り付け"],
  "本机连接／回复文本": ["This device’s connection / reply text", "この端末の接続／応答テキスト"],
  "复制本机文本": ["Copy this device’s text", "この端末のテキストをコピー"],
  "发送已保存的游戏或即时存档": ["Send a saved game package or save state", "保存済みゲームまたはステートを送信"],
  "发送选中项": ["Send selected item", "選択した項目を送信"],
  "游戏会包含配套资源；即时存档包含保存时的游戏内文件。接收后在“本站文件”或“即时存档”中使用，不会自动运行。": ["Games include their resources; save states include their saved game files. Find received items in Site files or Save states. Receiving does not launch a game.", "ゲームにはリソース、ステートには保存時のゲーム内ファイルが含まれます。受信後はサイト内ファイルやステートから利用できます。自動起動はしません。"],
  "接收并保存": ["Receive and save", "受信して保存"],
  "拒绝": ["Reject", "拒否"],
  "传输进度": ["Transfer progress", "転送の進行状況"],
  "连接失败时请检查访客 Wi-Fi、设备隔离或浏览器局域网权限。传输中请勿锁屏；中断后需重新发送。": ["If connection fails, check guest Wi-Fi, device isolation, and browser local-network permissions. Keep devices unlocked during transfer; interrupted transfers must be sent again.", "接続できない場合はゲスト Wi-Fi、端末間の分離、ブラウザーの LAN 権限を確認してください。転送中は画面をロックしないでください。中断時は再送信が必要です。"],
  "正在生成连接文本…": ["Generating connection text…", "接続テキストを生成中…"],
  "把本机文本发给对方，等待回复。": ["Send this device’s text to the other device and wait for its reply.", "この端末のテキストを相手に渡し、応答を待ってください。"],
  "把本机回复文本发回发起方，等待完成配对。": ["Send this reply text back to the initiating device to finish pairing.", "応答テキストを接続元に返し、ペアリングの完了を待ってください。"],
  "正在连接，请保持双方页面在前台…": ["Connecting; keep both pages in the foreground…", "接続中。両方のページを前面に保ってください…"],
  "连接文本已复制。": ["Connection text copied.", "接続テキストをコピーしました。"],
  "请长按或使用复制快捷键复制已选中的文本。": ["Long-press or use your copy shortcut to copy the selected text.", "長押しまたはコピーのショートカットで選択したテキストをコピーしてください。"],
  "正在准备文件，请稍候…": ["Preparing the file…", "ファイルを準備中…"],
  "等待对方确认接收…": ["Waiting for the recipient to accept…", "相手の受信確認を待っています…"],
  "正在接收，完成后校验并保存…": ["Receiving; the file will be verified and saved…", "受信中。完了後に検証して保存します…"],
  "此浏览器不支持设备互传，请使用新版浏览器。": ["This browser does not support device transfer. Use a newer browser.", "このブラウザーはデバイス間転送に対応していません。新しいブラウザーをご利用ください。"],
  "尚未连接。": ["Not connected.", "未接続です。"],
  "传输：{0} / {1}；完成后等待对方保存。": ["Transfer: {0} / {1}; wait for the recipient to save when complete.", "転送：{0} / {1}。完了後は相手の保存を待ちます。"],
  "对方想发送：{0} · {1} · {2}": ["Incoming: {0} · {1} · {2}", "受信要求：{0} · {1} · {2}"],
  "游戏及资源": ["Game and resources", "ゲームとリソース"],
  "请确认是否接收。": ["Choose whether to receive this file.", "このファイルを受信するか選んでください。"],
  "正在校验并保存…": ["Verifying and saving…", "検証して保存中…"],
  "连接文本无效，请完整复制。": ["Invalid connection text. Copy the entire text.", "接続テキストが無効です。全体をコピーしてください。"],
  "连接失败，请检查同一局域网及设备隔离设置，再重新配对。": ["Connection failed. Check that both devices share a LAN and device isolation is off, then pair again.", "接続できません。同じ LAN に接続し、端末間の分離設定を確認して再度ペアリングしてください。"],
  "连接暂时中断，正在等待恢复…": ["Connection interrupted; waiting to reconnect…", "接続が一時中断しました。復旧を待っています…"],
  "已连接，可以双向发送。": ["Connected. Either device can send.", "接続しました。双方向に送信できます。"],
  "连接或传输超时，请保持双方页面在前台并重新配对。": ["Connection or transfer timed out. Keep both pages in the foreground and pair again.", "接続または転送がタイムアウトしました。両方のページを前面にして再度ペアリングしてください。"],
  "连接已断开，未完成的接收不会保存。": ["Disconnected. Incomplete transfers are not saved.", "切断しました。未完了の受信は保存されません。"],
  "请先粘贴发起方的连接文本。": ["Paste the initiating device’s connection text first.", "先に接続元の接続テキストを貼り付けてください。"],
  "请粘贴接收方生成的回复文本。": ["Paste the reply text generated by the other device.", "相手が生成した応答テキストを貼り付けてください。"],
  "连接已关闭。": ["Connection closed.", "接続が閉じられました。"],
  "收集连接信息超时，请重新配对。": ["Gathering connection details timed out. Pair again.", "接続情報の収集がタイムアウトしました。再度ペアリングしてください。"],
  "连接未就绪或正在传输。": ["Connection not ready or a transfer is in progress.", "接続が未完了、または転送中です。"],
  "互传文件过大或无效。": ["Transfer file is too large or invalid.", "転送ファイルが大きすぎるか無効です。"],
  "已拒绝接收。": ["Transfer rejected.", "受信を拒否しました。"],
  "互传数据顺序或大小无效。": ["Invalid transfer data order or size.", "転送データの順序またはサイズが無効です。"],
  "互传消息无效。": ["Invalid transfer message.", "転送メッセージが無効です。"],
  "对方拒绝接收或正在传输。": ["The recipient rejected the file or is busy transferring.", "相手が受信を拒否したか、別の転送中です。"],
  "对方已校验并保存。": ["The recipient has verified and saved the file.", "相手が検証して保存しました。"],
  "互传文件不完整，未保存。": ["Incomplete transfer; nothing saved.", "転送ファイルが不完全なため保存していません。"],
  "互传校验失败，未保存。": ["Transfer verification failed; nothing saved.", "転送の検証に失敗したため保存していません。"],
  "已校验并保存到本机。": ["Verified and saved on this device.", "検証し、この端末に保存しました。"],
  "互传游戏包格式或校验无效。": ["Invalid game package format or checksum.", "ゲームパッケージの形式またはチェックサムが無効です。"],
  "本机已有此游戏，未覆盖。需要更新资源时请先移除本地游戏副本。": ["This game already exists on this device and was not overwritten. Remove the local game copy first if you need to update its resources.", "この端末には既に同じゲームがあるため上書きしませんでした。リソースを更新する場合は先にローカルのゲームを削除してください。"],

  '网站游戏库':['Website games','サイトのゲーム'],
  '网站即时存档':['Website save states','サイトのステート'],
  '正在处理，请稍后重试。':['Working, please try again shortly.','処理中です。しばらくしてから再試行してください。'],
  '游戏列表已变化，请重新打开前端后重试。':['The game list has changed. Reopen the frontend and try again.','ゲーム一覧が変更されました。フロントエンドを開き直して再試行してください。'],
  '网页操作':['Web controls','ウェブ操作'],
  'F1 打开／收起菜单':['F1: open / close menu','F1：メニューを開く／閉じる'],
  'F1 打开／收起 RetroArch 菜单；方向键选择，X 确认，Z 返回（默认映射）。':['F1 opens / closes the RetroArch menu; use arrows to select, X to confirm and Z to go back (default bindings).','F1 で RetroArch メニューを開閉。方向キーで選択、X で決定、Z で戻る（初期設定）。'],
  'RetroArch 前端':['RetroArch frontend','RetroArch フロントエンド'],
  'RetroArch 菜单':['RetroArch menu','RetroArch メニュー'],
  '字体、XMB 图标、菜单音效和 Neo RetroPad 来自 RetroArch 网页资源包，随包附带 CC BY 4.0 许可。':['Fonts, XMB icons, menu sounds, and Neo RetroPad come from the RetroArch web asset bundle, which includes the CC BY 4.0 license.','フォント、XMB アイコン、メニュー音、Neo RetroPad は RetroArch の Web リソースパック由来で、CC BY 4.0 ライセンスが付属しています。'],
  '本网站使用的资源：font.ttf（原文件名 chinese-fallback-font.ttf）、retroarch.png、XMB monochrome 图标、sounds 菜单音效及 Neo RetroPad 默认皮肤。资源打包供网页加载，原始许可保留在包内。':['Resources used: font.ttf (originally chinese-fallback-font.ttf), retroarch.png, XMB monochrome icons, menu sounds, and the default Neo RetroPad skin. Assets are packed for web loading with their original licenses included.','使用リソース：font.ttf（元の名前は chinese-fallback-font.ttf）、retroarch.png、XMB monochrome アイコン、メニュー音、Neo RetroPad の標準スキン。Web 読み込み用にまとめ、元のライセンスを同梱しています。'],
  '菜单／继续':['Menu / Resume','メニュー／再開'],
  '返回网页':['Back to page','ページへ戻る'],
  '中止':['Stop','終了'],
  '结束当前运行，保留游戏文件和已保存存档。':['End the current session, keeping game files and saved states.','現在の実行を終了し、ゲームファイルと保存済みステートを保持します。'],
  '中止运行，测量已结束':['Session stopped; measurement ended','実行を終了したため計測を終了'],
  '继续游戏':['Resume game','ゲームを再開'],
  '打开菜单':['Open menu','メニューを開く'],
  '进入 RetroArch 菜单，测量已结束':['RetroArch menu opened; measurement ended','RetroArch メニューを開いたため計測を終了'],
  '无法加载 RetroArch 前端资源，请联网后重试。':['Unable to load RetroArch frontend assets. Connect and try again.','RetroArch のリソースを読み込めません。接続して再試行してください。'],
  'RetroArch 菜单未能启动，请重试。':['RetroArch menu failed to start. Please try again.','RetroArch メニューを起動できませんでした。再試行してください。'],
  "JIT(A320）": ["JIT (A320)", "JIT(A320）"],
  "立即切换 JIT，保留当前进度。": ["Switch JIT now, keeping your progress.", "進行状況を保ったまま JIT を切り替えます。"],
  "Wasm JIT：已开启": ["Wasm JIT: On", "Wasm JIT：オン"],
  "Wasm JIT：已开启 · 部分代码使用解释器回退": ["Wasm JIT: On · Some code uses interpreter fallback", "Wasm JIT：オン · 一部のコードはインタープリターで実行"],
  "已选择开启": ["On selected", "オンを選択"],
  "已选择关闭": ["Off selected", "オフを選択"],
  "Wasm JIT：{0} · 等待游戏": ["Wasm JIT: {0} · Waiting for game", "Wasm JIT：{0} · ゲーム読み込み待ち"],
  "Wasm JIT：当前 A330 游戏不适用": ["Wasm JIT: Not applicable to this A330 game", "Wasm JIT：この A330 ゲームには適用されません"],
  "Wasm JIT：已关闭 · 使用解释器": ["Wasm JIT: Off · Interpreter", "Wasm JIT：オフ · インタープリター"],
  "Wasm JIT：暂不可用 · 使用解释器": ["Wasm JIT: Unavailable · Interpreter", "Wasm JIT：利用不可 · インタープリター"],
  "无法切换 JIT，请重试。": ["Unable to switch JIT. Please try again.", "JIT を切り替えられませんでした。もう一度お試しください。"],
  "切换 JIT，测量已结束": ["JIT switched; measurement ended", "JIT 切り替えのため計測を終了"],

  "Worker 初始化失败，已回退主线程": ["Worker initialization failed; using main thread", "Worker の初期化に失敗し、メインスレッドで実行"],
  "音频缓冲": ["Audio buffer", "音声バッファー"],
  "下次启动生效": ["Applies on next game start", "次回のゲーム起動時に適用"],
  "下次载入游戏生效": ["Applies next time a game loads", "次回のゲーム読み込み時に適用"],
  "核心：Worker": ["Core: Worker", "コア：Worker"],
  "核心：主线程（{0}）": ["Core: main thread ({0})", "コア：メインスレッド（{0}）"],
  "已选择主线程": ["Main thread selected", "メインスレッドを選択"],
  "浏览器不支持核心 Worker 所需功能": ["Required core Worker features unavailable", "コア Worker に必要な機能が未対応"],
  "Worker 图形支持检测未通过": ["Worker graphics probe failed", "Worker 描画の確認に失敗"],
  "等待载入": ["Waiting for game", "ゲーム読み込み待ち"],
  "核心运行：{0}": ["Core execution: {0}", "コア実行：{0}"],
  "主线程": ["Main thread", "メインスレッド"],
  "Worker": ["Worker", "Worker"],

  "正在下载离线运行包：{0}/{1} 项；首次下载可能需要几分钟。": ["Downloading offline resources: {0}/{1}; the first download may take a few minutes.", "オフラインリソースをダウンロード中：{0}/{1} 件。初回は数分かかる場合があります。"],
  "下载超时": ["Download timed out", "ダウンロードがタイムアウトしました"],
  "浏览器缓存写入失败": ["Browser cache write failed", "ブラウザーのキャッシュへの書き込みに失敗しました"],
  "资源下载失败": ["Resource download failed", "リソースのダウンロードに失敗しました"],
  "离线准备失败：{0}（{1}）。请检查网络和浏览器存储空间后，点击“获取最新版”重试。": ["Offline setup failed: {0} ({1}). Check your connection and browser storage, then click Get latest version to retry.", "オフライン設定に失敗：{0}（{1}）。接続とブラウザーの空き容量を確認し、「最新版を取得」で再試行してください。"],
  "离线准备失败：{0}。请检查网络和浏览器存储空间后，点击“获取最新版”重试。": ["Offline setup failed: {0}. Check your connection and browser storage, then click Get latest version to retry.", "オフライン設定に失敗：{0}。接続とブラウザーの空き容量を確認し、「最新版を取得」で再試行してください。"],
  "离线包下载仍未完成，请检查网络后刷新重试。": ["Offline download is still incomplete. Check your connection and reload to retry.", "オフラインリソースのダウンロードが完了していません。接続を確認し、再読み込みして再試行してください。"],
  "离线准备未完成：{0}": ["Offline setup incomplete: {0}", "オフライン設定が完了していません：{0}"],
  "采集仅在本机进行；详细模式包含逐帧计时开销，轻量模式只读取计数。": ["Measurements stay on this device; detailed mode adds per-frame timing overhead, while light mode only reads counters.", "計測はこの端末内で行います。詳細モードにはフレームごとの計時負荷があり、軽量モードはカウンターのみを読み取ります。"],
  "Wasm JIT 实验：A320 整数代码块 · {0} 已编译 · {1} 次执行": ["Experimental Wasm JIT: A320 integer blocks · {0} compiled · {1} executions", "実験的 Wasm JIT：A320 整数ブロック · コンパイル済み {0} · 実行回数 {1}"],
  "执行模式：Wasm JIT 实验（A320 部分整数指令；其余回退解释器）。": ["Execution mode: experimental Wasm JIT (some A320 integer instructions; other operations use the interpreter).", "実行モード：実験的 Wasm JIT（A320 の一部の整数命令。他の処理はインタープリターで実行）。"],
  "清除所有数据": ["Clear all data", "すべてのデータを削除"],
  "删除本站全部游戏、资源、游戏内存档、即时存档、设置和离线缓存。此操作无法撤销，请先导出需要的备份。": ["Delete all games, resources, in-game saves, save states, settings and offline caches for this site. This cannot be undone. Export any backups you need first.", "このサイトのゲーム、リソース、ゲーム内セーブ、ステートセーブ、設定、オフラインキャッシュをすべて削除します。元に戻せません。必要なバックアップを先にエクスポートしてください。"],
  "请联网后再清除所有数据，以便重新下载运行资源。": ["Connect to the internet before clearing all data so runtime resources can be downloaded again.", "実行用リソースを再ダウンロードするため、インターネットに接続してからすべてのデータを削除してください。"],
  "清除本站所有数据？全部游戏、资源、游戏内存档、即时存档、设置和离线缓存都会删除，且无法恢复。请先导出需要的备份并关闭本站其他窗口。确认后页面将刷新。": ["Clear all data for this site? All games, resources, in-game saves, save states, settings and offline caches will be deleted and cannot be recovered. Export any backups you need and close other windows for this site first. The page will reload after confirmation.", "このサイトのすべてのデータを削除しますか？ゲーム、リソース、ゲーム内セーブ、ステートセーブ、設定、オフラインキャッシュをすべて削除し、復元できません。必要なバックアップをエクスポートして、このサイトの他のウインドウを閉じてください。確認後、ページを再読み込みします。"],
  "正在清除本站所有数据…": ["Clearing all site data…", "サイトの全データを削除中…"],
  "本站所有数据已清除，正在刷新…": ["All site data cleared. Reloading…", "サイトの全データを削除しました。再読み込み中…"],
  "清理未完成，部分数据可能已删除。请检查浏览器权限，重试清理或刷新页面。": ["Cleanup did not finish; some data may already have been deleted. Check browser permissions, then retry cleanup or reload the page.", "削除が完了していません。一部のデータはすでに削除されている可能性があります。ブラウザーの権限を確認し、削除を再試行するかページを再読み込みしてください。"],
  "请关闭本站其他窗口，清理将在解除占用后继续。": ["Close other windows for this site. Cleanup will continue once their database connections close.", "このサイトの他のウインドウを閉じてください。データベースの接続が閉じると、削除を続行します。"],
  "本站数据正在清除，请刷新页面后再操作。": ["Site data is being cleared. Reload the page before continuing.", "サイトのデータを削除しています。ページを再読み込みしてから操作してください。"],
  "获取最新版": ["Get latest version", "最新版を取得"],
  "重新下载页面与运行资源，保留游戏、存档和设置。": ["Download the page and runtime resources again, keeping games, saves, and settings.", "ページと実行用リソースを再ダウンロードします。ゲーム、セーブ、設定は保持されます。"],
  "请联网后再获取最新版，以便重新下载运行资源。": ["Connect to the internet before getting the latest version so runtime resources can be downloaded again.", "実行用リソースを再ダウンロードするため、インターネットに接続してから最新版を取得してください。"],
  "获取最新版并刷新页面？将清除本站离线缓存并重新下载资源。游戏、存档和设置会保留；当前游戏将停止，未存档的进度会丢失。": ["Get the latest version and reload? This will clear the site’s offline caches and download resources again. Games, saves, and settings will be kept. The current game will stop and unsaved progress will be lost.", "最新版を取得して再読み込みしますか？オフラインキャッシュを削除し、リソースを再ダウンロードします。ゲーム、セーブ、設定は保持されます。実行中のゲームは終了し、未保存の進行状況は失われます。"],
  "正在准备获取最新版…": ["Preparing to get the latest version…", "最新版の取得を準備中…"],
  "正在重新加载页面…": ["Reloading the page…", "ページを再読み込み中…"],
  "未能获取最新版，页面未刷新。请检查游戏文件保存状态和浏览器权限后重试。": ["Could not get the latest version; the page was not reloaded. Check game file saving and browser permissions, then try again.", "最新版を取得できなかったため、再読み込みしていません。ゲームファイルの保存状態とブラウザーの権限を確認して、もう一度お試しください。"],
  "画面显示": ["Video display", "画面表示"],
  "显示模式": ["Display mode", "表示モード"],
  "原始像素": ["Original pixels", "オリジナルピクセル"],
  "平滑显示": ["Smooth display", "スムーズ表示"],
  "整数倍缩放": ["Integer scaling", "整数倍スケーリング"],
  "保留清晰的像素边缘，画面等比铺满。": ["Keep crisp pixel edges and fit the available area without stretching.", "ピクセルの輪郭を保ち、縦横比を維持して表示領域に合わせます。"],
  "柔化放大后的像素边缘，文字可能略模糊。": ["Soften enlarged pixel edges; text may look slightly blurry.", "拡大時の輪郭を滑らかにします。文字が少しぼやける場合があります。"],
  "按屏幕像素整数倍显示，画面可能变小并留黑边；空间不足时等比缩小。": ["Use integer multiples of screen pixels. The image may be smaller with black borders; shrink to fit if space is limited.", "画面の物理ピクセルに整数倍で表示します。余白ができる場合があります。領域が不足する場合は縦横比を保って縮小します。"],
  "无法切换画面显示，请重试。": ["Unable to change the video display. Please try again.", "画面表示を切り替えられませんでした。もう一度お試しください。"],
  "语言": [
    "Language",
    "言語"
  ],
  "界面语言": [
    "Interface language",
    "表示言語"
  ],
  "丁果游戏模拟器 · 可安装为网页应用 · 离线运行 · 即时存档 · 存档共享(导入导出／设备互传) · 局域网串流": ["Dingoo game emulator · Installable web app · Offline play · Save states · Save-state sharing (import/export or device transfer) · LAN remote play", "Dingoo ゲームエミュレーター · Web アプリとしてインストール可能 · オフライン対応 · ステートセーブ · セーブ共有(インポート・エクスポート／デバイス間転送) · LAN ストリーミング"],
  "添加到桌面或主屏幕，像应用一样独立打开。": ["Add to your desktop or home screen to open in its own window, like an app.", "デスクトップやホーム画面に追加して、アプリのように独立したウインドウで開けます。"],
  "关于本站": ["About this site", "このサイトについて"],
  "丁果 A320 掌机": ["Dingoo A320 handheld", "Dingoo A320 携帯ゲーム機"],
  "歌美 A330 掌机": ["Gemei A330 handheld", "Gemei A330 携帯ゲーム機"],
  "DingooEmu Web 在浏览器中运行丁果 A320（Dingoo A320）和歌美 A330（Gemei A330）掌机的原生游戏与应用。": ["DingooEmu Web runs native games and applications for the Dingoo A320 and Gemei A330 handhelds in your browser.", "DingooEmu Web は、Dingoo A320 と Gemei A330 向けのネイティブゲームやアプリケーションをブラウザーで実行します。"],
  "支持导入 A320 的 .app 和 A330 的 .cc、.c2s、.c3s 文件，也支持 ZIP 游戏包。": ["Import A320 .app files or A330 .cc, .c2s and .c3s files. ZIP game packages are also supported.", "A320 の .app ファイルと A330 の .cc、.c2s、.c3s ファイルをインポートできます。ZIP ゲームパッケージにも対応しています。"],
  "本站基于 RetroArch 的 WebAssembly 运行环境，让 DingooEmu 核心在浏览器中运行，并提供网页操作界面。": ["This site uses RetroArch's WebAssembly runtime to run the DingooEmu core in the browser and provides a web interface for controlling it.", "このサイトは RetroArch の WebAssembly 実行環境を利用して DingooEmu コアをブラウザー上で動作させ、Web ベースの操作画面を提供しています。"],
  "模拟核心：": ["Emulation core: ", "エミュレーションコア："],
  "运行环境：": ["Runtime: ", "実行環境："],
  "项目链接": ["Project links", "プロジェクトリンク"],
  "本站源码": ["Site source", "サイトのソースコード"],
  "开源许可与第三方声明": ["Open-source licenses and third-party notices", "オープンソースライセンスと第三者の表記"],
  "游戏由您从本机导入。游戏文件、游戏内存档与即时存档保存在当前浏览器中，可通过本站导出备份。": ["Import games from your device. Game files, in-game saves and save states are stored in this browser and can be exported from this site for backup.", "ゲームは端末からインポートします。ゲームファイル、ゲーム内セーブ、ステートセーブはこのブラウザーに保存され、このサイトからバックアップ用にエクスポートできます。"],
  "返回模拟器": ["Back to emulator", "エミュレーターに戻る"],
  "本站使用以下开源项目与资源。完整许可文本保留原文。": ["This site uses the open-source projects and assets listed below. Full license texts are preserved in their original form.", "このサイトでは、以下のオープンソースプロジェクトと素材を使用しています。ライセンス全文は原文のまま掲載しています。"],
  "项目主页": ["Upstream project", "元プロジェクト"],
  "许可全文": ["Full license text", "ライセンス全文"],
  "下载许可文本": ["Download license text", "ライセンス文書をダウンロード"],
  "本文所列许可分别适用于对应组件。": ["Each license listed here applies to its corresponding component.", "各ライセンスは、それぞれの対応するコンポーネントに適用されます。"],
  "本站将 DingooEmu 的 libretro 核心与 RetroArch 编译为 WebAssembly，并提供网页操作界面。": ["This site compiles the DingooEmu libretro core and RetroArch to WebAssembly and provides a web interface.", "このサイトでは DingooEmu の libretro コアと RetroArch を WebAssembly にコンパイルし、Web ベースの操作画面を提供しています。"],
  "第三方资源": ["Third-party assets", "第三者の素材"],
  "字体和载入动画图标来自 RetroArch 网页资源包，随包附带 CC BY 4.0 许可。": ["The font and loading icon come from the RetroArch web assets package, which includes a CC BY 4.0 license.", "フォントと読み込みアイコンは RetroArch の Web 素材パッケージに由来し、同梱のライセンスは CC BY 4.0 です。"],
  "本网站使用的资源：font.ttf（原文件名 chinese-fallback-font.ttf）和 retroarch.png；图标缩放用于载入动画。": ["Assets used by this site: font.ttf (originally chinese-fallback-font.ttf) and retroarch.png; the icon is scaled for the loading animation.", "このサイトで使用する素材：font.ttf（元のファイル名 chinese-fallback-font.ttf）と retroarch.png。アイコンは読み込みアニメーション用に拡大・縮小しています。"],
  "DingooEmu 附带的第三方声明": ["Third-party notices included with DingooEmu", "DingooEmu に同梱の第三者の表記"],
  "上游文档列出了启用 JIT 的构建所使用的第三方组件；此处保留原始声明。": ["The upstream document lists third-party components used by JIT-enabled builds; its original notices are preserved here.", "元の文書には JIT を有効にしたビルドで使用される第三者のコンポーネントが記載されています。ここでは元の表記を保持しています。"],
  "支持 .app / .cc / .c2s / .c3s 和 ZIP 游戏包": ["Supports .app / .cc / .c2s / .c3s and ZIP game packages", ".app / .cc / .c2s / .c3s と ZIP ゲームパッケージに対応"],
  "请选择 .app / .cc / .c2s / .c3s 或 ZIP 文件。": [
    "Choose an .app / .cc / .c2s / .c3s or ZIP file.",
    ".app / .cc / .c2s / .c3s、または ZIP ファイルを選択してください。"
  ],
  "安装网页应用": [
    "Install web app",
    "Web アプリを追加"
  ],
  "添加到主屏幕": ["Add to Home Screen", "ホーム画面に追加"],
  "添加到程序坞": ["Add to Dock", "Dock に追加"],
  "需要 macOS Sonoma 14 或更高版本。": [
    "Requires macOS Sonoma 14 or later.",
    "macOS Sonoma 14 以降が必要です。"
  ],
  "在 Safari 菜单栏选择“文件”→“添加到程序坞”，或在“共享”菜单中选择“添加到程序坞”。": [
    "In the Safari menu bar, choose File → Add to Dock, or choose Add to Dock from the Share menu.",
    "Safari のメニューバーで「ファイル」→「Dock に追加」を選ぶか、共有メニューから「Dock に追加」を選びます。"
  ],
  "确认名称后点“添加”。": [
    "Confirm the name, then click Add.",
    "名前を確認して「追加」をクリックします。"
  ],
  "从程序坞中的 DingooEmu Web 图标打开，即可在独立窗口中使用。": [
    "Open DingooEmu Web from its Dock icon to use it in a separate window.",
    "Dock の DingooEmu Web アイコンから開くと、独立したウインドウで使えます。"
  ],
  "如果当前浏览器没有以下选项，请用 Safari 打开本站。": [
    "If these options are missing in your browser, open this site in Safari.",
    "以下の項目がブラウザーにない場合は、Safari でこのサイトを開いてください。"
  ],
  "点浏览器的“分享”按钮，选择“添加到主屏幕”。": [
    "Tap your browser's Share button, then choose Add to Home Screen.",
    "ブラウザーの共有ボタンをタップし、「ホーム画面に追加」を選びます。"
  ],
  "如果出现“作为网页 App 打开”，保持开启，然后点“添加”。": [
    "If Open as Web App appears, leave it enabled, then tap Add.",
    "「Web アプリとして開く」が表示されたらオンのままにし、「追加」をタップします。"
  ],
  "从主屏幕上的 DingooEmu Web 图标打开，即可隐藏浏览器栏。": [
    "Open DingooEmu Web from its Home Screen icon to hide the browser bars.",
    "ホーム画面の DingooEmu Web アイコンから開くと、ブラウザーのバーが非表示になります。"
  ],
  "A320 画面": [
    "Game screen",
    "ゲーム画面"
  ],
  "模拟帧率": [
    "Emulated frame rate",
    "エミュレーションのフレームレート"
  ],
  "十字方向键，支持多方向与滑动": [
    "D-pad with diagonal and sliding input",
    "斜め入力とスライドに対応した方向キー"
  ],
  "游戏设置": [
    "Game settings",
    "ゲーム設定"
  ],
  "关闭设置": [
    "Close settings",
    "設定を閉じる"
  ],
  "全屏": [
    "Fullscreen",
    "全画面"
  ],
  "退出全屏": [
    "Exit fullscreen",
    "全画面を終了"
  ],
  "虚拟手柄": [
    "Touch controls",
    "タッチ操作"
  ],
  "显示 FPS": [
    "Show FPS",
    "FPS を表示"
  ],
  "静音": [
    "Mute",
    "ミュート"
  ],
  "虚拟按键不透明度": [
    "Touch button opacity",
    "タッチボタンの不透明度"
  ],
  "0% 外观不可见；关闭虚拟手柄可停用游戏触摸操作。": [
    "At 0%, buttons are invisible. Turn off touch controls to disable touch input.",
    "0% ではボタンが見えなくなります。タッチ操作をオフにすると入力も無効になります。"
  ],
  "设置按钮透明度": [
    "Settings button opacity",
    "設定ボタンの不透明度"
  ],
  "启用声音": [
    "Enable audio",
    "音声を有効にする"
  ],
  "调整按键位置": [
    "Arrange controls",
    "ボタン配置を調整"
  ],
  "恢复默认位置": [
    "Reset positions",
    "配置を初期化"
  ],
  "调整时拖动十字键、各按键或全屏设置按钮，完成后保存。": [
    "Drag the D-pad, buttons or fullscreen settings button, then save.",
    "方向キー、各ボタン、全画面の設定ボタンをドラッグしてから保存してください。"
  ],
  "完成位置调整": [
    "Save positions",
    "配置を保存"
  ],
  "拖动按键到合适位置；调整期间不向游戏发送按键。点击“完成位置调整”保存。": [
    "Drag controls into place. Game input is disabled while editing. Select “Save positions” when finished.",
    "ボタンをドラッグして配置します。調整中はゲームに入力されません。「配置を保存」で完了します。"
  ],
  "导入游戏": [
    "Import game",
    "ゲームをインポート"
  ],
  "导入文件夹": [
    "Import folder",
    "フォルダーをインポート"
  ],
  "继续": [
    "Resume",
    "再開"
  ],
  "暂停": [
    "Pause",
    "一時停止"
  ],
  "重置": [
    "Reset",
    "リセット"
  ],
  "即时存档": [
    "Save state",
    "ステートセーブ"
  ],
  "即时读档": [
    "Load state",
    "ステートロード"
  ],
  "选择包内的游戏": [
    "Choose a game in the package",
    "パッケージ内のゲームを選択"
  ],
  "载入": [
    "Load",
    "読み込む"
  ],
  "取消": [
    "Cancel",
    "キャンセル"
  ],
  "本次导入的资源": [
    "Imported resources",
    "インポートしたリソース"
  ],
  "资源随游戏保存在本机；添加或移除资源会重新载入游戏。": [
    "Resources are stored locally with the game. Adding or removing them reloads the game.",
    "リソースはゲームと一緒に端末に保存されます。追加・削除するとゲームを再読み込みします。"
  ],
  "添加资源": [
    "Add resources",
    "リソースを追加"
  ],
  "键盘映射": [
    "Keyboard bindings",
    "キー割り当て"
  ],
  "点击按键后按新的物理键。重复绑定会交换两个按键。": [
    "Select a button, then press a keyboard key. Existing bindings are swapped if duplicated.",
    "ボタンを選択してからキーボードのキーを押してください。重複する割り当ては入れ替わります。"
  ],
  "恢复默认": [
    "Reset to defaults",
    "初期設定に戻す"
  ],
  "运行测量": [
    "Performance measurement",
    "パフォーマンス測定"
  ],
  "等待首帧。": [
    "Waiting for the first frame.",
    "最初のフレームを待っています。"
  ],
  "设备 / 场景备注（可选）": [
    "Device / scene notes (optional)",
    "端末・場面のメモ（任意）"
  ],
  "测量模式": [
    "Measurement mode",
    "測定モード"
  ],
  "轻量：帧率和音频（推荐）": [
    "Light: frame rate and audio (recommended)",
    "軽量：フレームレートと音声（推奨）"
  ],
  "详细：包含每帧核心耗时": [
    "Detailed: include per-frame core timings",
    "詳細：各フレームのコア処理時間を含む"
  ],
  "测量 30 秒": [
    "Measure for 30 seconds",
    "30 秒間測定"
  ],
  "提前结束": [
    "Stop measurement",
    "測定を終了"
  ],
  "复制报告": [
    "Copy report",
    "レポートをコピー"
  ],
  "进入卡顿场景后点击测量，期间可以正常操作游戏。": [
    "Start measuring in a slow scene. You can keep playing during measurement.",
    "動作が重い場面で測定を開始してください。測定中もゲームを操作できます。"
  ],
  "测量摘要": [
    "Measurement summary",
    "測定の概要"
  ],
  "性能测量报告": [
    "Performance report",
    "パフォーマンスレポート"
  ],
  "本站文件": [
    "Site files",
    "サイト内ファイル"
  ],
  "导入的游戏、资源和游戏写出的文件保存在当前网址的浏览器中。选择已保存的游戏后可直接运行。修改当前游戏的文件会先停止游戏。": [
    "Imported games, resources and written files are stored in this browser for this site. Select a saved game to run it. Editing its files stops the current game first.",
    "ゲーム、リソース、出力ファイルは、このサイトのブラウザー内に保存されます。保存済みのゲームを選ぶと実行できます。実行中のゲームのファイルを変更する場合は、先にゲームを停止します。"
  ],
  "游戏": [
    "Game",
    "ゲーム"
  ],
  "选择游戏文件空间": [
    "Choose a game file space",
    "ゲームのファイル領域を選択"
  ],
  "运行": [
    "Run",
    "実行"
  ],
  "导出备份": [
    "Export backup",
    "バックアップをエクスポート"
  ],
  "导出当前文件": [
    "Export current files",
    "現在のファイルをエクスポート"
  ],
  "重试保存": [
    "Retry saving",
    "保存を再試行"
  ],
  "导入文件 / 备份": [
    "Import files / backup",
    "ファイル・バックアップをインポート"
  ],
  "删除此游戏的全部文件": [
    "Delete all game files",
    "このゲームの全ファイルを削除"
  ],
  "移除本地游戏": [
    "Remove local game",
    "ローカルのゲームを削除"
  ],
  "刷新列表": [
    "Refresh list",
    "一覧を更新"
  ],
  "导出": [
    "Export",
    "エクスポート"
  ],
  "删除": [
    "Delete",
    "削除"
  ],
  "保存当前执行进度和游戏写出的文件。每次保存新增一个存档；读档后直接继续运行。": [
    "Save the current execution state and written files. Each save creates a new entry. Loading resumes play immediately.",
    "現在の実行状態と出力ファイルを保存します。保存するたびに新しいステートを追加し、読み込むとそのまま再開します。"
  ],
  "全部游戏": [
    "All games",
    "すべてのゲーム"
  ],
  "存档": [
    "State",
    "ステート"
  ],
  "选择即时存档": [
    "Choose a save state",
    "セーブステートを選択"
  ],
  "新增即时存档": [
    "New save state",
    "ステートを新規保存"
  ],
  "读取选中存档": [
    "Load selected state",
    "選択したステートを読み込む"
  ],
  "导入即时存档": [
    "Import save state",
    "ステートをインポート"
  ],
  "删除选中存档": [
    "Delete selected state",
    "選択したステートを削除"
  ],
  "清空列表中的存档": [
    "Delete listed states",
    "一覧のステートをすべて削除"
  ],
  "请按新键…（Esc 取消）": [
    "Press a new key… (Esc to cancel)",
    "新しいキーを押してください…（Esc でキャンセル）"
  ],
  "导入游戏后显示实际音频驱动。": [
    "The active audio driver appears after importing a game.",
    "ゲームをインポートすると、使用中の音声ドライバーが表示されます。"
  ],
  "没有保存此游戏包，请重新导入游戏。": [
    "This game package is not stored. Import the game again.",
    "ゲームのパッケージが保存されていません。再度インポートしてください。"
  ],
  "游戏已停止，修改文件后可在“本站文件”点击“运行”。": [
    "Game stopped. After editing files, select “Run” in “Site files”.",
    "ゲームを停止しました。ファイルを変更した後、「サイト内ファイル」の「実行」で再開できます。"
  ],
  "保存即时存档，测量已结束": [
    "Saving a state ended the measurement",
    "ステートの保存により測定を終了しました"
  ],
  "读取即时存档，测量已结束": [
    "Loading a state ended the measurement",
    "ステートの読み込みにより測定を終了しました"
  ],
  "即时读档完成，游戏已继续运行。": [
    "State loaded. Game resumed.",
    "ステートを読み込み、ゲームを再開しました。"
  ],
  "页面隐藏，已暂停。": [
    "Page hidden. Game paused.",
    "ページが非表示になったため、一時停止しました。"
  ],
  "正在读取游戏与本站文件…": [
    "Loading game and site files…",
    "ゲームとサイト内ファイルを読み込んでいます…"
  ],
  "本站文件已载入 · {0} 个": [
    "Site files loaded · {0} files",
    "サイト内ファイルを読み込みました · {0} 個"
  ],
  "已载入。页面隐藏，已暂停。": [
    "Loaded. Page hidden; game paused.",
    "読み込みました。ページが非表示のため、一時停止しています。"
  ],
  "已载入。": [
    "Loaded.",
    "読み込みました。"
  ],
  "未找到 .app / .cc / .c2s / .c3s 游戏。": [
    "No .app / .cc / .c2s / .c3s game found.",
    ".app / .cc / .c2s / .c3s のゲームが見つかりません。"
  ],
  "导入包中有多个游戏，请选择要载入的游戏。": [
    "This package contains multiple games. Choose one to load.",
    "パッケージ内に複数のゲームがあります。読み込むゲームを選んでください。"
  ],
  "游戏或 ZIP 超过 128 MiB。": [
    "Game or ZIP exceeds 128 MiB.",
    "ゲームまたは ZIP が 128 MiB を超えています。"
  ],
  "已取消导入。": [
    "Import canceled.",
    "インポートをキャンセルしました。"
  ],
  "本次导入的资源 · {0} 个 · {1}": [
    "Imported resources · {0} files · {1}",
    "インポートしたリソース · {0} 個 · {1}"
  ],
  "移除并重载": [
    "Remove and reload",
    "削除して再読み込み"
  ],
  "移除 {0} 并重新载入游戏？": [
    "Remove {0} and reload the game?",
    "{0} を削除してゲームを再読み込みしますか？"
  ],
  "覆盖同名资源并重新载入游戏？": [
    "Replace resources with matching names and reload the game?",
    "同名のリソースを上書きしてゲームを再読み込みしますか？"
  ],
  "程序已结束。": [
    "Program ended.",
    "プログラムが終了しました。"
  ],
  "页面切到后台，测量提前结束": [
    "Page moved to background; measurement stopped early",
    "ページがバックグラウンドに移ったため、測定を終了しました"
  ],
  "游戏已载入。": [
    "Game loaded.",
    "ゲームを読み込みました。"
  ],
  "移除此游戏及资源的本地副本？游戏内存档和即时存档会保留。": [
    "Remove the local game and resource copies? In-game saves and save states will be kept.",
    "ゲームとリソースのローカルコピーを削除しますか？ゲーム内のセーブとステートは残ります。"
  ],
  "本地游戏已移除，可重新导入。": [
    "Local game removed. You can import it again.",
    "ローカルのゲームを削除しました。再度インポートできます。"
  ],
  "删除此游戏的全部本站文件？请先导出备份。": [
    "Delete all site files for this game? Export a backup first.",
    "このゲームのサイト内ファイルをすべて削除しますか？先にバックアップをエクスポートしてください。"
  ],
  "此游戏的本站文件已删除。": [
    "Site files for this game deleted.",
    "このゲームのサイト内ファイルを削除しました。"
  ],
  "游戏文件：{0} · 本地游戏及资源：{1} · {2} 个游戏": [
    "Game files: {0} · Local games and resources: {1} · {2} games",
    "ゲーム内ファイル：{0} · ローカルのゲームとリソース：{1} · {2} ゲーム"
  ],
  "打开面板查看文件。": [
    "Open this panel to view files.",
    "このパネルを開くとファイルを表示します。"
  ],
  "尚无游戏文件记录。导入游戏后建立独立的文件空间。": [
    "No game files yet. Import a game to create its own file space.",
    "ゲームのファイルはまだありません。インポートすると専用のファイル領域を作成します。"
  ],
  "{0} 个文件 · {1} · {2}": [
    "{0} files · {1} · {2}",
    "{0} 個のファイル · {1} · {2}"
  ],
  "尚无游戏内文件。": [
    "No in-game files yet.",
    "ゲーム内ファイルはまだありません。"
  ],
  " · 游戏已保存，可直接运行。": [
    " · Game stored and ready to run.",
    " · ゲームは保存済みで、そのまま実行できます。"
  ],
  " · 旧记录没有游戏副本，请重新导入游戏以启用运行。": [
    " · No game copy in this older entry. Import it again to enable Run.",
    " · 旧記録にゲーム本体がありません。再度インポートすると実行できます。"
  ],
  "尚未产生游戏内存档或其他文件。": [
    "No in-game saves or other files have been created yet.",
    "ゲーム内のセーブやファイルはまだ作成されていません。"
  ],
  "文件已变化，请刷新列表。": [
    "File changed. Refresh the list.",
    "ファイルが変更されました。一覧を更新してください。"
  ],
  "删除 {0}？": [
    "Delete {0}?",
    "{0} を削除しますか？"
  ],
  "文件已删除。": [
    "File deleted.",
    "ファイルを削除しました。"
  ],
  " · 浏览器存储约 {0} / {1}（含离线缓存）": [
    " · Browser storage about {0} / {1} (including offline cache)",
    " · ブラウザーの保存容量 約 {0} / {1}（オフラインキャッシュを含む）"
  ],
  "已导出游戏文件备份。": [
    "Game file backup exported.",
    "ゲームのファイルのバックアップをエクスポートしました。"
  ],
  "请先选择游戏。": [
    "Select a game first.",
    "先にゲームを選択してください。"
  ],
  "备份文件过大。": [
    "Backup file is too large.",
    "バックアップファイルが大きすぎます。"
  ],
  "ZIP 文件过大。": [
    "ZIP file is too large.",
    "ZIP ファイルが大きすぎます。"
  ],
  "诊断文件不属于游戏存档。": [
    "Diagnostic files are not game saves.",
    "診断ファイルはゲームのセーブではありません。"
  ],
  "将覆盖同名的本站文件。继续导入？": [
    "Site files with matching names will be replaced. Continue importing?",
    "同名のサイト内ファイルを上書きします。インポートを続けますか？"
  ],
  "游戏记录已变化，请刷新列表。": [
    "Game entry changed. Refresh the list.",
    "ゲームの記録が変更されました。一覧を更新してください。"
  ],
  "文件列表刚刚变化，仍要覆盖同名文件？": [
    "The file list just changed. Replace matching files anyway?",
    "ファイル一覧が変更されました。同名のファイルを上書きしますか？"
  ],
  "文件已导入，运行游戏即可使用。": [
    "Files imported. Run the game to use them.",
    "ファイルをインポートしました。ゲームを実行すると使用できます。"
  ],
  "当前游戏没有匹配的即时存档。": [
    "No matching save state for this game.",
    "このゲームに対応するステートがありません。"
  ],
  "即时存档已导出。": [
    "Save state exported.",
    "ステートをエクスポートしました。"
  ],
  "删除选中的即时存档？请先导出备份。": [
    "Delete the selected save state? Export a backup first.",
    "選択したステートを削除しますか？先にバックアップをエクスポートしてください。"
  ],
  "即时存档已删除。": [
    "Save state deleted.",
    "ステートを削除しました。"
  ],
  "清空当前列表中的 {0} 个即时存档？请先导出备份。": [
    "Delete all {0} save states in this list? Export backups first.",
    "一覧にある {0} 個のステートをすべて削除しますか？先にバックアップをエクスポートしてください。"
  ],
  "列表中的即时存档已清空。": [
    "Listed save states deleted.",
    "一覧のステートをすべて削除しました。"
  ],
  "即时存档已导入。运行匹配的游戏和资源后可读取。": [
    "Save state imported. Run the matching game and resources to load it.",
    "ステートをインポートしました。対応するゲームとリソースを実行すると読み込めます。"
  ],
  "{0} · {1} · 核心版本 {2} · {3}": [
    "{0} · {1} · Core version {2} · {3}",
    "{0} · {1} · コアバージョン {2} · {3}"
  ],
  "匹配当前游戏": [
    "Matches current game",
    "現在のゲームに対応"
  ],
  "请运行匹配的游戏及资源": [
    "Run the matching game and resources",
    "対応するゲームとリソースを実行してください"
  ],
  "尚无即时存档。运行游戏后点击“即时存档”。": [
    "No save states yet. Run a game and select “Save state”.",
    "ステートはまだありません。ゲームを実行して「ステートセーブ」を選んでください。"
  ],
  "{0} 个即时存档 · {1}": [
    "{0} save states · {1}",
    "{0} 個のステート · {1}"
  ],
  "请先运行游戏。": [
    "Run a game first.",
    "先にゲームを実行してください。"
  ],
  "正在保存即时存档…": [
    "Saving state…",
    "ステートを保存しています…"
  ],
  "即时存档已保存。": [
    "Save state saved.",
    "ステートを保存しました。"
  ],
  "即时存档与当前游戏或资源不匹配。": [
    "Save state does not match the current game or resources.",
    "ステートが現在のゲームまたはリソースと一致しません。"
  ],
  "正在读取即时存档…": [
    "Loading state…",
    "ステートを読み込んでいます…"
  ],
  "请通过浏览器菜单安装网页应用。": [
    "Install the app using your browser menu.",
    "ブラウザーのメニューからアプリをインストールしてください。"
  ],
  "离线安装支持将在构建版本中启用。": [
    "Offline installation is available in the production build.",
    "オフラインインストールはビルド版で利用できます。"
  ],
  "安装和离线运行需要 HTTPS 或本机地址。": [
    "Installation and offline play require HTTPS or localhost.",
    "インストールとオフライン実行には HTTPS または localhost が必要です。"
  ],
  "正在准备离线运行包…": [
    "Preparing offline package…",
    "オフライン実行用のファイルを準備しています…"
  ],
  "新版已准备好，关闭所有应用窗口后重新打开即可更新。": [
    "Update ready. Close all app windows and reopen to update.",
    "新版を準備しました。すべてのアプリウィンドウを閉じて開き直すと更新されます。"
  ],
  "离线运行已就绪": [
    "Ready for offline play",
    "オフライン実行の準備ができました"
  ],
  "离线模式 · 可导入本地 .app": [
    "Offline mode · Import local .app games",
    "オフラインモード · 端末の .app をインポートできます"
  ],
  "新版离线准备未完成；当前版本仍可离线使用。": [
    "New offline package incomplete; the current version still works offline.",
    "新版のオフライン準備は未完了ですが、現在の版はオフラインで使用できます。"
  ],
  "离线准备未完成，联网后刷新重试。": [
    "Offline setup incomplete. Connect and refresh to retry.",
    "オフライン準備が完了していません。接続後に再読み込みしてください。"
  ],
  "正在启用独立音频线程，即将刷新…": [
    "Enabling the audio thread. Refreshing shortly…",
    "独立した音声スレッドを有効にしています。まもなく再読み込みします…"
  ],
  " · 结束游戏后刷新，可重试启用独立音频线程。": [
    " · Refresh after ending the game to retry enabling the audio thread.",
    " · ゲーム終了後に再読み込みすると、音声スレッドの有効化を再試行できます。"
  ],
  " · 当前声音使用兼容模式，可刷新重试。": [
    " · Audio is in compatibility mode. Refresh to retry.",
    " · 音声は互換モードです。再読み込みで再試行できます。"
  ],
  "退出全屏失败，请使用浏览器的退出全屏操作。": [
    "Could not exit fullscreen. Use the browser's fullscreen control.",
    "全画面を終了できませんでした。ブラウザーの全画面終了操作を使用してください。"
  ],
  "浏览器未启用原生全屏，已改为铺满网页。": [
    "Browser fullscreen is unavailable; the game fills the page instead.",
    "ブラウザーの全画面表示を利用できないため、ページいっぱいに表示しています。"
  ],
  "未提供": [
    "Unavailable",
    "取得不可"
  ],
  "手动结束": [
    "Stopped manually",
    "手動で終了"
  ],
  "游戏暂停、重置、切换或结束，测量提前结束": [
    "Game paused, reset, switched or ended; measurement stopped early",
    "ゲームの一時停止・リセット・切り替え・終了により測定を終了しました"
  ],
  "测量中 · 剩余 30 秒，请保持在当前游戏场景": [
    "Measuring · 30 seconds left. Stay in this game scene.",
    "測定中 · 残り 30 秒。この場面を維持してください。"
  ],
  "测量中 · 剩余 {0} 秒": [
    "Measuring · {0} seconds left",
    "測定中 · 残り {0} 秒"
  ],
  "完成": [
    "Completed",
    "完了"
  ],
  "测量完成": [
    "Measurement complete",
    "測定完了"
  ],
  "{0} · 已记录 {1} 秒，可复制报告或截图": [
    "{0} · Recorded {1} seconds. Copy the report or take a screenshot.",
    "{0} · {1} 秒間記録しました。レポートのコピーやスクリーンショットができます。"
  ],
  "模拟帧数：": [
    "Emulated frames: ",
    "エミュレーションのフレーム数："
  ],
  "核心耗时": [
    "Core time",
    "コア処理時間"
  ],
  "模拟帧间隔 ": [
    "Emulated frame interval ",
    "フレーム間隔 "
  ],
  "合计耗时超过 ": [
    "Combined time above ",
    "合計処理時間が超過 "
  ],
  "音频新增缺样周期：": [
    "New audio underrun cycles: ",
    "音声の欠損周期の増加："
  ],
  "DingooEmu 性能报告 v2": [
    "DingooEmu performance report v2",
    "DingooEmu パフォーマンスレポート v2"
  ],
  "时间：{0}": [
    "Time: {0}",
    "時刻：{0}"
  ],
  "游戏：{0}": [
    "Game: {0}",
    "ゲーム：{0}"
  ],
  "设备 / 场景备注：{0}": [
    "Device / scene notes: {0}",
    "端末・場面のメモ：{0}"
  ],
  "未填写": [
    "Not specified",
    "未記入"
  ],
  "结果：{0} · 实测 {1} 秒": [
    "Result: {0} · Measured for {1} seconds",
    "結果：{0} · 測定時間 {1} 秒"
  ],
  "测量模式：{0}": [
    "Measurement mode: {0}",
    "測定モード：{0}"
  ],
  "轻量（每秒读取计数，不启用逐帧计时）": [
    "Light (read counters once per second; no per-frame timing)",
    "軽量（毎秒カウンターを取得、各フレームの計時なし）"
  ],
  "详细（逐帧计时，含少量额外开销）": [
    "Detailed (per-frame timing with some overhead)",
    "詳細（各フレームを計時、追加負荷あり）"
  ],
  "浏览器：{0}": [
    "Browser: {0}",
    "ブラウザー：{0}"
  ],
  "页面：{0}×{1} · DPR {2} · {3}": [
    "Page: {0}×{1} · DPR {2} · {3}",
    "ページ：{0}×{1} · DPR {2} · {3}"
  ],
  "独立应用窗口": [
    "Standalone app window",
    "独立したアプリウィンドウ"
  ],
  "浏览器窗口": [
    "Browser window",
    "ブラウザーのウィンドウ"
  ],
  "安全上下文：{0} · 共享内存隔离：{1} · 声音 {2} · 缓冲目标 {3} ms": [
    "Secure context: {0} · Cross-origin isolation: {1} · Audio {2} · Target buffer {3} ms",
    "安全なコンテキスト：{0} · クロスオリジン分離：{1} · 音声 {2} · バッファ目標 {3} ms"
  ],
  "开启": [
    "On",
    "オン"
  ],
  "关闭": [
    "Off",
    "オフ"
  ],
  "模拟帧数：{0} · 平均 {1} FPS": [
    "Emulated frames: {0} · Average {1} FPS",
    "エミュレーションのフレーム数：{0} · 平均 {1} FPS"
  ],
  "游戏指令数：{0} · 每模拟帧平均 {1}": [
    "Guest instructions: {0} · Average per emulated frame {1}",
    "ゲーム命令数：{0} · 1 フレーム平均 {1}"
  ],
  "分段 FPS 最低 / 最高：{0}": [
    "Interval FPS min / max: {0}",
    "区間 FPS 最小 / 最大：{0}"
  ],
  "核心耗时 平均 / P50 / P95 / 最大：{0} ms": [
    "Core time mean / P50 / P95 / max: {0} ms",
    "コア処理時間 平均 / P50 / P95 / 最大：{0} ms"
  ],
  "核心耗时：轻量模式未逐帧计时": [
    "Core time: no per-frame timing in light mode",
    "コア処理時間：軽量モードでは各フレームを計時しません"
  ],
  "画面提交 平均 / P95：{0} / {1} ms": [
    "Video submission mean / P95: {0} / {1} ms",
    "映像送信 平均 / P95：{0} / {1} ms"
  ],
  "音频提交 平均 / P95：{0} / {1} ms": [
    "Audio submission mean / P95: {0} / {1} ms",
    "音声送信 平均 / P95：{0} / {1} ms"
  ],
  "以上三项合计平均：{0} ms": [
    "Combined mean of the three phases: {0} ms",
    "上記 3 項目の合計平均：{0} ms"
  ],
  "模拟帧间隔 平均 / P95 / 最大：{0} ms": [
    "Emulated frame interval mean / P95 / max: {0} ms",
    "フレーム間隔 平均 / P95 / 最大：{0} ms"
  ],
  "合计耗时超过 16.67 ms：{0}/{1} 帧 ({2}%)": [
    "Combined time above 16.67 ms: {0}/{1} frames ({2}%)",
    "合計処理時間が 16.67 ms を超過：{0}/{1} フレーム（{2}%）"
  ],
  "音频新增缺样周期：{0}": [
    "New audio underrun cycles: {0}",
    "音声の欠損周期の増加：{0}"
  ],
  "核心音频积压 平均 / 最低 / 最高：{0}": [
    "Core audio backlog mean / min / max: {0}",
    "コア音声の滞留 平均 / 最小 / 最大：{0}"
  ],
  "输出音频队列 平均 / 最低 / 最高：{0}": [
    "Output audio queue mean / min / max: {0}",
    "出力音声キュー 平均 / 最小 / 最大：{0}"
  ],
  "浏览器处理 / 设备输出估计：{0} / {1} ms": [
    "Browser processing / estimated device output: {0} / {1} ms",
    "ブラウザー処理 / 推定デバイス出力：{0} / {1} ms"
  ],
  "计数为实际模拟帧，不等同于屏幕刷新率。": [
    "Counts are actual emulated frames, not the display refresh rate.",
    "実際にエミュレーションしたフレーム数で、画面のリフレッシュレートとは異なります。"
  ],
  "没有采集到模拟帧，请确认游戏运行后重新测量。": [
    "No emulated frames recorded. Confirm the game is running and measure again.",
    "フレームを取得できませんでした。ゲームの実行を確認して再測定してください。"
  ],
  "P95 表示 95% 的样本不超过该耗时。画面提交为 CPU 侧耗时，未包含 GPU 完成和屏幕显示。": [
    "P95 means 95% of samples are at or below this time. Video submission measures CPU time, excluding GPU completion and display latency.",
    "P95 は標本の 95% がこの時間以内であることを示します。映像送信は CPU 側の時間で、GPU の完了や画面表示は含みません。"
  ],
  "缺样按音频处理周期计数，不等同于爆音次数；设备输出为浏览器估计，未测量按键或蓝牙端到端延迟。": [
    "Underruns are counted per audio processing cycle, not per audible pop. Device output is a browser estimate; input and Bluetooth end-to-end latency are not measured.",
    "欠損は音声処理周期ごとに数え、ノイズの回数とは異なります。デバイス出力はブラウザーの推定値で、入力や Bluetooth の総遅延は測定していません。"
  ],
  "采集仅在本机进行；逐帧计时有额外开销。游戏核心仍使用解释器。": [
    "Data is collected locally. Per-frame timing adds overhead. The game core still uses an interpreter.",
    "測定は端末内で行います。各フレームの計時には追加負荷があります。ゲームコアは引き続きインタープリターを使用します。"
  ],
  "采集仅在本机进行；每秒读取已有计数，未启用逐帧计时。游戏核心仍使用解释器。": [
    "Data is collected locally. Existing counters are read once per second without per-frame timing. The game core still uses an interpreter.",
    "測定は端末内で行います。既存のカウンターを毎秒取得し、各フレームは計時しません。ゲームコアは引き続きインタープリターを使用します。"
  ],
  "计时样本达到上限，分位数只覆盖前 4096 帧。": [
    "Timing sample limit reached; percentiles cover only the first 4096 frames.",
    "計時標本の上限に達しました。分位数は最初の 4096 フレームのみを対象とします。"
  ],
  "逐段记录（累计秒 | FPS | 核心积压 ms | 输出队列 ms | 累计缺样）": [
    "Interval log (elapsed seconds | FPS | core backlog ms | output queue ms | total underruns)",
    "区間記録（経過秒 | FPS | コア滞留 ms | 出力キュー ms | 欠損合計）"
  ],
  "{0} | {1} | {2} | {3} | {4}": [
    "{0} | {1} | {2} | {3} | {4}",
    "{0} | {1} | {2} | {3} | {4}"
  ],
  "报告已复制，可以粘贴到聊天中。": [
    "Report copied. You can paste it into the chat.",
    "レポートをコピーしました。チャットに貼り付けられます。"
  ],
  "自动复制不可用。报告已选中，请长按选择“复制”，或截图。": [
    "Automatic copy unavailable. The report is selected; copy it manually or take a screenshot.",
    "自動コピーは利用できません。レポートを選択しました。手動でコピーするかスクリーンショットを撮ってください。"
  ],
  "运行包需要更新：请关闭全部应用窗口，重新打开并导入游戏。": [
    "Runtime update required. Close all app windows, reopen, then import the game.",
    "実行環境の更新が必要です。すべてのアプリウィンドウを閉じて開き直し、ゲームをインポートしてください。"
  ],
  "运行包需要更新，请刷新网页后重新导入游戏。": [
    "Runtime update required. Refresh the page and import the game again.",
    "実行環境の更新が必要です。ページを再読み込みし、ゲームを再度インポートしてください。"
  ],
  "测量运行包不可用。": [
    "Measurement runtime unavailable.",
    "測定用の実行環境を利用できません。"
  ],
  "AudioWorklet · 独立音频线程": [
    "AudioWorklet · Dedicated audio thread",
    "AudioWorklet · 独立した音声スレッド"
  ],
  "当前为普通 HTTP，声音使用 RWebAudio；手机低延迟音频需要 HTTPS 和共享内存隔离响应头。": [
    "Using RWebAudio over plain HTTP. Low-latency mobile audio requires HTTPS and cross-origin isolation headers.",
    "通常の HTTP のため RWebAudio を使用しています。スマートフォンの低遅延音声には HTTPS と分離用のレスポンスヘッダーが必要です。"
  ],
  "当前未启用共享内存隔离，声音使用 RWebAudio；请检查页面上方的离线准备提示，结束游戏后再刷新重试。": [
    "Cross-origin isolation is off; using RWebAudio. Check the offline setup status above, then refresh after ending the game.",
    "クロスオリジン分離が無効のため RWebAudio を使用しています。上部のオフライン準備状況を確認し、ゲーム終了後に再読み込みしてください。"
  ],
  "当前声音使用 RWebAudio。": [
    "Audio uses RWebAudio.",
    "音声は RWebAudio を使用しています。"
  ],
  "请选择 .app / .cc / .c2s / .c3s 游戏。": [
    "Choose an .app / .cc / .c2s / .c3s game.",
    ".app / .cc / .c2s / .c3s のゲームを選択してください。"
  ],
  "游戏文件为空或超过 128 MiB。": [
    "Game file is empty or exceeds 128 MiB.",
    "ゲームファイルが空か、128 MiB を超えています。"
  ],
  "正在初始化 RetroArch 后端…": [
    "Initializing RetroArch runtime…",
    "RetroArch 実行環境を初期化しています…"
  ],
  "无法加载运行资源：{0}": [
    "Could not load runtime resource: {0}",
    "実行用リソースを読み込めません：{0}"
  ],
  "运行包需要更新：请关闭全部应用窗口，重新打开后再导入游戏。": [
    "Runtime update required. Close all app windows, reopen, then import the game.",
    "実行環境の更新が必要です。すべてのアプリウィンドウを閉じて開き直し、ゲームをインポートしてください。"
  ],
  "RetroArch 初始化失败。\n": [
    "RetroArch initialization failed.\n",
    "RetroArch の初期化に失敗しました。\n"
  ],
  "RetroArch 未能启动游戏。\n": [
    "RetroArch could not start the game.\n",
    "RetroArch でゲームを開始できませんでした。\n"
  ],
  "RetroArch 尚未开始运行，未进入可保存状态。": [
    "RetroArch has not started; state saving is unavailable.",
    "RetroArch がまだ実行されていないため、ステートを保存できません。"
  ],
  "游戏文件写入失败，当前会话已保留，请重试。": [
    "Game file write failed. Current session kept; retry saving.",
    "ゲームのファイルを書き込めませんでした。現在の状態は保持しています。再試行してください。"
  ],
  "游戏文件超过 64 MiB 或 2048 个，当前会话已保留。": [
    "Game files exceed 64 MiB or 2048 files. Current session kept.",
    "ゲームのファイルが 64 MiB または 2048 個を超えています。現在の状態は保持しています。"
  ],
  "游戏文件写入失败。": [
    "Game file write failed.",
    "ゲームのファイルを書き込めませんでした。"
  ],
  "正在保存游戏文件…": [
    "Saving game files…",
    "ゲームのファイルを保存しています…"
  ],
  "游戏文件已保存 · {0} 个": [
    "Game files saved · {0} files",
    "ゲームのファイルを保存しました · {0} 個"
  ],
  "保存失败：{0} 可重试保存或导出当前文件。": [
    "Save failed: {0} Retry saving or export current files.",
    "保存に失敗しました：{0} 再試行するか、現在のファイルをエクスポートしてください。"
  ],
  "请先载入游戏，并更新运行包。": [
    "Load a game and update the runtime first.",
    "先にゲームを読み込み、実行環境を更新してください。"
  ],
  "即时存档容量无效。": [
    "Invalid save state capacity.",
    "ステートの容量が無効です。"
  ],
  "内存不足，无法保存即时存档。": [
    "Not enough memory to save state.",
    "メモリ不足のためステートを保存できません。"
  ],
  "核心保存即时存档失败，当前进度已保留。": [
    "Core could not save state. Current progress kept.",
    "コアでステートを保存できませんでした。現在の進行状態は保持しています。"
  ],
  "即时存档平台不匹配。": [
    "Save state platform mismatch.",
    "ステートのプラットフォームが一致しません。"
  ],
  "内存不足，无法读取即时存档。": [
    "Not enough memory to load state.",
    "メモリ不足のためステートを読み込めません。"
  ],
  "核心拒绝此即时存档，当前进度已保留。": [
    "Core rejected this save state. Current progress kept.",
    "コアがこのステートを拒否しました。現在の進行状態は保持しています。"
  ],
  "请先运行匹配的游戏。": [
    "Run the matching game first.",
    "先に対応するゲームを実行してください。"
  ],
  "读档文件已保存 · {0} 个": [
    "Loaded state files saved · {0} files",
    "読み込んだステートのファイルを保存しました · {0} 個"
  ],
  "读档失败且回退失败：{0}。请导出当前文件后重新载入。": [
    "State load and rollback failed: {0}. Export current files, then reload the game.",
    "ステートの読み込みと復元に失敗しました：{0}。現在のファイルをエクスポートしてから再読み込みしてください。"
  ],
  "\n核心积压：{0} · 输出队列：{1}\n浏览器处理：{2} · 设备输出估计：{3}": [
    "\nCore backlog: {0} · Output queue: {1}\nBrowser processing: {2} · Estimated device output: {3}",
    "\nコア滞留：{0} · 出力キュー：{1}\nブラウザー処理：{2} · 推定デバイス出力：{3}"
  ],
  " · 缺样计数：{0}": [
    " · Underruns: {0}",
    " · 欠損回数：{0}"
  ],
  "游戏已加载。": [
    "Game loaded.",
    "ゲームを読み込みました。"
  ],
  "后端：RetroArch + DingooEmu Libretro\n编译：wasm32-unknown-emscripten · {0}\n音频缓冲目标：{1} ms{2}{3}\n{4}\n输入：0x{5}\nFPS 由 RetroArch 在画面内显示。": [
    "Runtime: RetroArch + DingooEmu Libretro\nBuild: wasm32-unknown-emscripten · {0}\nAudio target buffer: {1} ms{2}{3}\n{4}\nInput: 0x{5}\nFPS is shown by RetroArch in the game screen.",
    "実行環境：RetroArch + DingooEmu Libretro\nビルド：wasm32-unknown-emscripten · {0}\n音声バッファ目標：{1} ms{2}{3}\n{4}\n入力：0x{5}\nFPS はゲーム画面内に RetroArch が表示します。"
  ],
  "游戏未启动，请重新导入。": [
    "Game is not running. Import it again.",
    "ゲームが起動していません。再度インポートしてください。"
  ],
  "旧的 RetroArch 后端未退出，请刷新页面后重试。": [
    "The previous RetroArch runtime did not exit. Refresh and retry.",
    "前の RetroArch 実行環境が終了していません。ページを再読み込みしてください。"
  ],
  "请选择包内的游戏文件。": [
    "Choose a game file in the package.",
    "パッケージ内のゲームファイルを選択してください。"
  ],
  "导入最多 2048 个文件、总计 128 MiB。": [
    "Import limit: 2048 files, 128 MiB total.",
    "インポートの上限は 2048 ファイル、合計 128 MiB です。"
  ],
  "ZIP 为空、过大或格式无效。": [
    "ZIP is empty, too large or invalid.",
    "ZIP が空、大きすぎる、または形式が無効です。"
  ],
  "ZIP 数据不完整。": [
    "ZIP data is incomplete.",
    "ZIP データが不完全です。"
  ],
  "找不到 ZIP 目录。": [
    "ZIP directory not found.",
    "ZIP のディレクトリが見つかりません。"
  ],
  "不支持分卷、ZIP64 或过多文件的 ZIP。": [
    "Split archives, ZIP64 and ZIPs with too many files are unsupported.",
    "分割 ZIP、ZIP64、ファイル数が多すぎる ZIP は未対応です。"
  ],
  "ZIP 文件目录无效。": [
    "Invalid ZIP directory.",
    "ZIP のディレクトリが無効です。"
  ],
  "ZIP 包含加密、链接或不支持的压缩格式。": [
    "ZIP contains encryption, links or unsupported compression.",
    "ZIP に暗号化、リンク、または未対応の圧縮形式が含まれています。"
  ],
  "ZIP 文件名需使用 UTF-8，请重新打包或导入文件夹。": [
    "ZIP filenames must use UTF-8. Repack it or import a folder.",
    "ZIP のファイル名は UTF-8 が必要です。再作成するかフォルダーをインポートしてください。"
  ],
  "ZIP 解压后超过 128 MiB。": [
    "Uncompressed ZIP exceeds 128 MiB.",
    "ZIP の展開後のサイズが 128 MiB を超えています。"
  ],
  "ZIP 文件头不匹配。": [
    "ZIP header mismatch.",
    "ZIP のヘッダーが一致しません。"
  ],
  "ZIP 文件数据与目录重叠。": [
    "ZIP file data overlaps the directory.",
    "ZIP のファイルデータとディレクトリが重複しています。"
  ],
  "ZIP 解压长度超出声明。": [
    "Uncompressed ZIP exceeds its declared size.",
    "ZIP の展開サイズが宣言されたサイズを超えています。"
  ],
  "无法解压 ZIP，可改用文件夹导入：{0}": [
    "Could not decompress ZIP. Try importing a folder: {0}",
    "ZIP を展開できません。フォルダーのインポートを試してください：{0}"
  ],
  "ZIP 文件校验失败：{0}": [
    "ZIP file checksum failed: {0}",
    "ZIP のファイルの検証に失敗しました：{0}"
  ],
  "ZIP 目录长度无效。": [
    "Invalid ZIP directory length.",
    "ZIP のディレクトリの長さが無効です。"
  ],
  "文件路径无效。": [
    "Invalid file path.",
    "ファイルのパスが無効です。"
  ],
  "非法相对路径。": [
    "Invalid relative path.",
    "相対パスが無効です。"
  ],
  "空路径。": [
    "Empty path.",
    "パスが空です。"
  ],
  "文件路径过长或目录层级过多。": [
    "File path is too long or has too many levels.",
    "パスが長すぎるか、階層が多すぎます。"
  ],
  "文件数量或总大小超出限制。": [
    "File count or total size exceeds the limit.",
    "ファイル数または合計サイズが上限を超えています。"
  ],
  "重复路径：{0}": [
    "Duplicate path: {0}",
    "パスが重複しています：{0}"
  ],
  "文件与目录冲突：{0}": [
    "File and directory conflict: {0}",
    "ファイルとディレクトリが競合しています：{0}"
  ],
  "存档数据库被其他窗口阻塞，请关闭其他窗口后重试。": [
    "Save database is blocked by another window. Close other windows and retry.",
    "保存用データベースが別のウィンドウにブロックされています。ほかのウィンドウを閉じて再試行してください。"
  ],
  "游戏包无效或超过 128 MiB。": [
    "Game package is invalid or exceeds 128 MiB.",
    "ゲームのパッケージが無効か、128 MiB を超えています。"
  ],
  "游戏身份无效。": [
    "Invalid game identity.",
    "ゲームの識別情報が無効です。"
  ],
  "文件已被其他窗口修改，未覆盖。请先导出当前游戏文件，再重新载入。": [
    "Files changed in another window; nothing overwritten. Export current game files, then reload.",
    "別のウィンドウでファイルが変更されたため、上書きしていません。現在のファイルをエクスポートしてから再読み込みしてください。"
  ],
  "保存事务中止。": [
    "Save transaction aborted.",
    "保存処理が中止されました。"
  ],
  "文件列表已变化，请刷新列表后重试。": [
    "File list changed. Refresh it and retry.",
    "ファイル一覧が変更されました。更新して再試行してください。"
  ],
  "存档备份过大。": [
    "Save backup is too large.",
    "セーブのバックアップが大きすぎます。"
  ],
  "存档版本或游戏身份不匹配。": [
    "Save version or game identity mismatch.",
    "セーブのバージョンまたはゲームの識別情報が一致しません。"
  ],
  "存档文件数据无效。": [
    "Invalid save file data.",
    "セーブファイルのデータが無効です。"
  ],
  "即时存档核心数据无效。": [
    "Invalid core save state data.",
    "ステートのコアデータが無効です。"
  ],
  "即时存档核心版本或长度不匹配。": [
    "Core save state version or length mismatch.",
    "ステートのコアバージョンまたは長さが一致しません。"
  ],
  "即时存档版本、身份或长度无效。": [
    "Invalid save state version, identity or length.",
    "ステートのバージョン、識別情報、または長さが無効です。"
  ],
  "即时存档完整性校验失败。": [
    "Save state integrity check failed.",
    "ステートの整合性検証に失敗しました。"
  ],
  "即时存档文件完整性校验失败。": [
    "Save state file integrity check failed.",
    "ステートのファイルの整合性検証に失敗しました。"
  ],
  "即时存档文件大小无效。": [
    "Invalid save state file size.",
    "ステートファイルのサイズが無効です。"
  ],
  "即时存档文件格式无效。": [
    "Invalid save state file format.",
    "ステートファイルの形式が無効です。"
  ],
  "即时存档数据长度无效。": [
    "Invalid save state data length.",
    "ステートのデータ長が無効です。"
  ],
  "即时存档文件长度无效。": [
    "Invalid save state file length.",
    "ステートファイルの長さが無効です。"
  ],
  "即时存档存在多余或缺失的数据。": [
    "Save state contains extra or missing data.",
    "ステートのデータに余分な部分または欠落があります。"
  ],
  "即时存档已被删除，请刷新列表。": [
    "Save state was deleted. Refresh the list.",
    "ステートが削除されました。一覧を更新してください。"
  ]
};
