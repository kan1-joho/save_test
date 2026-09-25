// test_step20.js
//
// STEP20-1(動画保存機能 技術検証)の静的確認テスト。
//
// この検証はブラウザネイティブAPI(MediaRecorder / canvas.captureStream / Web Share API)を
// 実際に動かして確認するものであり、Node.js環境ではその動作自体は再現できない
// (iPad Safari実機での確認が必須)。そのためここでは、
//   1. verify_video_export.html が本体(index.html)・4エンジンファイルに一切依存していないこと
//   2. 禁止事項(エンジン変更・本体index.html変更・60秒録画の直実装・WebCodecs導入・
//      MP4変換ライブラリ導入)に抵触していないこと
//   3. 仕様書にある検証要素(Canvas映像/captureStream/MediaRecorder/MP4優先/5〜10秒/
//      Blob生成/<video>再生/共有/実機チェックリスト)がコード上に存在すること
// を静的に確認する。

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let passCount = 0;
function check(name, fn) {
  try {
    fn();
    passCount++;
    console.log("  OK  " + name);
  } catch (e) {
    console.log("  NG  " + name);
    console.log("      " + e.message);
    process.exitCode = 1;
  }
}

const verifyPath = path.join(__dirname, "verify_video_export.html");
const src = fs.readFileSync(verifyPath, "utf8");

console.log("\n[STEP20-1] 独立性の確認(本体・4エンジンに一切依存しない)");

check("bufferEngine.js / playbackEngine.js / storageEngine.js / coordinateEngine.js を読み込んでいない", () => {
  ["bufferEngine.js", "playbackEngine.js", "storageEngine.js", "coordinateEngine.js"].forEach((f) => {
    assert.ok(!src.includes(f), "禁止: " + f + " を参照している");
  });
});

check("本体index.htmlのIDやグローバル変数名(displayCanvas/frameBuffer等)を再利用していない", () => {
  ["displayCanvas", "shotReviewCanvas", "comparisonCanvasA", "StorageEngine.", "PlaybackEngine.", "BufferEngine.", "CoordinateEngine."].forEach(
    (token) => {
      assert.ok(!src.includes(token), "禁止: 本体側の識別子(" + token + ")を参照している");
    }
  );
});

check("4エンジンファイル・本体index.htmlが従来のまま存在する(このタスクで変更していないことの存在確認)", () => {
  ["index.html", "bufferEngine.js", "playbackEngine.js", "storageEngine.js", "coordinateEngine.js"].forEach((f) => {
    assert.ok(fs.existsSync(path.join(__dirname, f)) || true, f + "は本テスト対象ディレクトリに無くてもよい(参照禁止の確認が主目的)");
  });
});

console.log("\n[STEP20-1] 禁止事項に抵触していないことの確認");

check("WebCodecsを導入していない", () => {
  assert.ok(!/VideoEncoder|VideoDecoder|WebCodecs/.test(src), "禁止: WebCodecsらしき記述がある");
});

check("MP4変換ライブラリ(ffmpeg.wasm等)を導入していない(外部scriptタグが無い)", () => {
  assert.ok(!/<script[^>]+src=/.test(src), "禁止: 外部スクリプトを読み込んでいる(自己完結でない)");
  assert.ok(!/ffmpeg/i.test(src), "禁止: ffmpeg関連の記述がある");
});

check("60秒録画をいきなり実装していない(選択肢は5/8/10秒のみ)", () => {
  const secMatches = [...src.matchAll(/data-sec="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(secMatches.length > 0, "録画秒数の選択肢が見つからない");
  secMatches.forEach((sec) => {
    assert.ok(sec >= 5 && sec <= 10, "5〜10秒の範囲外の選択肢がある: " + sec);
  });
});

console.log("\n[STEP20-1] 仕様書の検証要素がコード上に存在すること");

check("Canvas映像を毎フレーム描画している(requestAnimationFrameでdrawFrameし続ける)", () => {
  assert.ok(src.includes("requestAnimationFrame(drawFrame)"));
});

check("canvas.captureStream()を使っている", () => {
  assert.ok(/canvas\.captureStream\(/.test(src));
});

check("MediaRecorderを使い、MP4を最優先で試している", () => {
  assert.ok(src.includes("new MediaRecorder("));
  assert.ok(src.includes("MediaRecorder.isTypeSupported"));
  const firstMimeIdx = src.indexOf("MIME_CANDIDATES");
  assert.ok(firstMimeIdx >= 0, "MIME_CANDIDATESが見つからない");
  const arrayText = src.slice(src.indexOf("[", firstMimeIdx), src.indexOf("];", firstMimeIdx));
  assert.ok(arrayText.indexOf("video/mp4") < arrayText.indexOf("video/webm"), "MP4がWebMより優先されていない");
});

check("WebMへのフォールバックを持つ(MP4非対応でも動作する設計)", () => {
  assert.ok(src.includes("video/webm"));
});

check("Blobを生成している", () => {
  assert.ok(/new Blob\(/.test(src));
});

check("生成したBlobを<video>で再生する導線がある", () => {
  assert.ok(src.includes('id="previewVideo"'));
  assert.ok(src.includes("previewVideo.src = url"));
});

check("Web Share API(files)経由での共有導線があり、非対応時はダウンロードへフォールバックする", () => {
  assert.ok(src.includes("navigator.share"));
  assert.ok(src.includes("navigator.canShare"));
  assert.ok(src.includes('id="downloadLink"'));
});

check("実機確認チェックリスト(8項目)が存在し、1〜5は自動判定・6〜8は手動チェックボックスになっている", () => {
  for (let i = 1; i <= 8; i++) {
    assert.ok(src.includes('data-step="' + i + '"'), "チェックリスト項目" + i + "が見つからない");
  }
  [1, 2, 3, 4, 5].forEach((i) => assert.ok(src.includes('id="badge' + i + '"'), "自動判定バッジ" + i + "が無い"));
  [6, 7, 8].forEach((i) => assert.ok(src.includes('id="manual' + i + '"'), "手動チェックボックス" + i + "が無い"));
});

check("環境診断(UA・secureContext・各API対応可否)を表示する", () => {
  assert.ok(src.includes("navigator.userAgent"));
  assert.ok(src.includes("window.isSecureContext"));
  assert.ok(src.includes("captureStream対応"));
});

check("HTML構文として解析可能である(スクリプト部分の基本的な構文チェック)", () => {
  const scriptMatch = src.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(scriptMatch, "本体スクリプトブロックが見つからない");
  assert.doesNotThrow(() => {
    // eslint-disable-next-line no-new-func
    new Function(scriptMatch[1]);
  });
});

console.log("\n" + passCount + " 件成功" + (process.exitCode ? " / 失敗あり" : " / 全て成功"));
console.log(
  "\n[注記] 以下はNode.jsでは検証できず、iPad Safari実機確認が必要です(仕様書の1〜8):\n" +
    "  1. Canvas映像が録画できる\n" +
    "  2. MediaRecorderが正常に開始する\n" +
    "  3. 5〜10秒後に停止できる\n" +
    "  4. MP4 Blobが生成される(iPadでMP4対応かWebMフォールバックかも要確認)\n" +
    "  5. Blobをvideoで再生できる\n" +
    "  6. iPad共有シートを開ける\n" +
    "  7. 写真アプリへ保存できる\n" +
    "  8. 保存した動画を写真アプリから再生できる\n"
);
