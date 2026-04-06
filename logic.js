/**
 * 千问 AI 答题助手 - v10.5 视觉巅峰版
 * 修复：全量更换为 5 个支持图片识别的顶尖模型
 */

// --- 1. 配置区域 (严禁改动) ---
var API_KEY = "sk-6234f2662aa04de2956fc47bc9e15cc8";
var API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

// 已更换为最顶级的 5 个视觉模型，确保切换后不再出现问号
var MODEL_LIST = [
    "qwen-vl-max-latest",      // 全能最强
    "qwen-vl-max",      // 深度推理(最准)
    "qwen-vl-ocr-latest",// 视觉理解巅峰
    "qwen2.5-vl-72b-instruct",     // 极速快答
    "qwen-vl-plus-latest"         // 商业稳定版
];
var currentIdx = 0;
var MODEL_NAME = MODEL_LIST[currentIdx];
var headerH = 48;

if (!requestScreenCapture()) {
    toast("需要截图权限");
    exit();
}

var cropX, cropY, cropW = 600, cropH = 450; 
var isSolving = false;

// --- 2. UI 构建 ---
var window = floaty.rawWindow(
    <frame id="root" bg="#00000000">
        <vertical id="red_frame_layout" w="*" h="*">
            <horizontal w="*" h={headerH} bg="#CC000000" gravity="center_vertical">
                <horizontal id="model_btn" layout_weight="1" h="*" gravity="center_vertical" paddingLeft="15">
                    <text id="model_label" text={"● " + MODEL_LIST[currentIdx]} color="#00FF00" textSize="12sp" />
                </horizontal>
                <text id="btn_close" text="✕" color="#FF4444" textSize="24sp" w="55" h="*" gravity="center" />
            </horizontal>

            <frame id="box_area" w="*" h="*">
                <View w="*" h="3" bg="#FF0000" layout_gravity="top" />
                <View w="*" h="3" bg="#FF0000" layout_gravity="bottom" />
                <View w="3" h="*" bg="#FF0000" layout_gravity="left" />
                <View w="3" h="*" bg="#FF0000" layout_gravity="right" />
                <frame id="drag_area" bg="#05FF0000">
                    <text id="hint" text="● 点击此处文字锁定选区 ●" color="#FF0000" textSize="12sp" textStyle="bold" gravity="center" />
                </frame>
                <View id="resize_handle" w="45" h="45" bg="#33FF0000" layout_gravity="bottom|right" />
            </frame>
        </vertical>

        <card id="ball_layout" w="300" h="100" cardCornerRadius="10" cardElevation="0" cardBackgroundColor="#01000000" visibility="gone" layout_gravity="center">
            <text id="ball_text" text="● 已就绪" color="#44000000" gravity="center" textSize="18sp" textStyle="bold" 
                shadowColor="#11FFFFFF" shadowDx="1" shadowDy="1" shadowRadius="1" />
        </card>
    </frame>
);

window.setSize(cropW, cropH + headerH);
window.setPosition(200, 400);

// --- 3. 交互逻辑 ---
window.btn_close.click(() => { exit(); });

window.model_btn.click(() => {
    threads.start(function() {
        var options = MODEL_LIST.map((m, i) => (i == currentIdx ? "● " : "○ ") + m);
        var res = dialogs.select("切换模型", options);
        if (res >= 0) {
            currentIdx = res;
            MODEL_NAME = MODEL_LIST[currentIdx];
            ui.run(() => { window.model_label.setText("● " + MODEL_NAME); });
        }
    });
});

var fx, fy, fv_x, fv_y;
window.drag_area.setOnTouchListener(function(v, event) {
    if (event.getAction() == event.ACTION_DOWN) {
        fx = event.getRawX(); fy = event.getRawY();
        fv_x = window.getX(); fv_y = window.getY();
    } else if (event.getAction() == event.ACTION_MOVE) {
        window.setPosition(fv_x + (event.getRawX() - fx), fv_y + (event.getRawY() - fy));
    } else if (event.getAction() == event.ACTION_UP) {
        var tx = event.getX();
        var ty = event.getY();
        var isCenterClick = (tx > v.getWidth() * 0.2 && tx < v.getWidth() * 0.8 && ty > v.getHeight() * 0.2 && ty < v.getHeight() * 0.8);
        if (Math.abs(event.getRawX() - fx) < 20 && isCenterClick) {
            switchToBall();
        }
    }
    return true;
});

var sx, sy, sw, sh;
window.resize_handle.setOnTouchListener(function(v, event) {
    if (event.getAction() == event.ACTION_DOWN) {
        sx = event.getRawX(); sy = event.getRawY();
        sw = window.getWidth(); sh = window.getHeight();
    } else if (event.getAction() == event.ACTION_MOVE) {
        window.setSize(Math.max(300, sw + (event.getRawX() - sx)), Math.max(200, sh + (event.getRawY() - sy)));
    }
    return true;
});

var lastClick = 0, ballTimer = null;
window.ball_layout.setOnTouchListener(function(v, event) {
    if (event.getAction() == event.ACTION_DOWN) {
        fx = event.getRawX(); fy = event.getRawY();
        fv_x = window.getX(); fv_y = window.getY();
        ballTimer = setTimeout(() => { device.vibrate(40); exit(); }, 2000);
    } else if (event.getAction() == event.ACTION_MOVE) {
        if (Math.abs(event.getRawX() - fx) > 10) clearTimeout(ballTimer);
        window.setPosition(fv_x + (event.getRawX() - fx), fv_y + (event.getRawY() - fy));
    } else if (event.getAction() == event.ACTION_UP) {
        clearTimeout(ballTimer);
        if (Math.abs(event.getRawX() - fx) < 25) {
            if (Date.now() - lastClick < 400) switchToFrame();
            else if (!isSolving) executeSolve();
            lastClick = Date.now();
        }
    }
    return true;
});

function switchToBall() {
    cropX = window.getX(); cropY = window.getY() + headerH;
    cropW = window.getWidth(); cropH = window.getHeight() - headerH;
    ui.run(() => {
        window.red_frame_layout.setVisibility(8);
        window.ball_layout.setVisibility(0);
        window.ball_text.setText("● 已就绪");
        window.setSize(300, 150); 
        window.setPosition(device.width - 450, device.height - 550);
    });
}

function switchToFrame() {
    ui.run(() => {
        window.ball_layout.setVisibility(8);
        window.red_frame_layout.setVisibility(0);
        window.setSize(cropW, cropH + headerH);
        window.setPosition(cropX, cropY - headerH);
    });
}

// --- 4. 业务逻辑 (保持原样) ---

function executeSolve() {
    isSolving = true;
    ui.run(() => { window.ball_text.setText("● 分析中..."); }); 
    threads.start(function () {
        try {
            var screen = captureScreen();
            var img = images.clip(screen, Math.max(0, cropX), Math.max(0, cropY), 
                                  Math.min(screen.width - cropX, cropW), 
                                  Math.min(screen.height - cropY, cropH));
            var base64 = imageToBase64(img);
            img.recycle();
            var res = requestAI(base64);
            ui.run(() => { window.ball_text.setText(parseAnswer(res)); });
        } catch (e) {
            ui.run(() => { window.ball_text.setText("?"); });
        } finally { 
            isSolving = false; 
        }
    });
}

function imageToBase64(img) {
    var baos = new java.io.ByteArrayOutputStream();
    img.getBitmap().compress(android.graphics.Bitmap.CompressFormat.JPEG, 60, baos);
    return android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP);
}

function requestAI(base64Img) {
    var payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": "你是专业的临床医学答题助手。请直接输出最终答案，严禁解释。选择题只输出大写字母选项；判断题只输出'正确'或'错误'；填空简答只输出最精炼答案。"
            },
            {
                "role": "user",
                "content": [
                    { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64," + base64Img } },
                    { "type": "text", "text": "输出答案" }
                ]
            }
        ],
        "temperature": 0.1
    };
    try {
        var res = http.postJson(API_URL, payload, { 
            headers: { "Authorization": "Bearer " + API_KEY }, 
            timeout: 60000 
        });
        return res.body.json().choices[0].message.content;
    } catch (e) { return "?"; }
}

function parseAnswer(raw) {
    var ans = raw.trim().replace(/[。\.]$/, ""); 
    if (ans.indexOf('正确') >= 0 || ans.indexOf('√') >= 0) return '正确';
    if (ans.indexOf('错误') >= 0 || ans.indexOf('×') >= 0) return '错误';
    var letters = ans.match(/[A-Z]/g);
    if (letters && ans.length < 8) return letters.join('');
    return ans.length > 25 ? ans.substring(0, 23) + ".." : ans;
}

setInterval(() => { }, 1000);
