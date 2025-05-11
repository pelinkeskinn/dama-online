from flask import Flask, render_template, request, redirect, session, url_for
from flask_socketio import SocketIO, join_room, emit
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
db = SQLAlchemy(app)
socketio = SocketIO(app)

# Kullanıcı modeli
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(80), nullable=False)

# Oda verisi (sunucudaki oyuncular)
rooms = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    user = User.query.filter_by(username=username, password=password).first()
    if user:
        session['username'] = username
        return redirect('/game')
    return 'Kullanıcı bulunamadı'

@app.route('/register', methods=['POST'])
def register():
    username = request.form['username']
    password = request.form['password']
    if User.query.filter_by(username=username).first():
        return 'Kullanıcı adı mevcut'
    user = User(username=username, password=password)
    db.session.add(user)
    db.session.commit()
    return redirect('/')

@app.route('/game')
def game():
    if 'username' in session:
        return render_template('game.html', username=session['username'])
    return redirect('/')

@socketio.on("join")
def handle_join(data):
    room = data["room"]
    username = data["username"]
    color = data.get("color", "red")

    join_room(room)

    if room not in rooms:
        rooms[room] = {}

    if username in rooms[room]:
        emit("assign_color", rooms[room][username], to=request.sid)
        return

    if color in rooms[room].values():
        emit("assign_color", "rejected", to=request.sid)
        return

    rooms[room][username] = color
    print(f"{username} oyuna katıldı. Renk: {color}")

    emit("assign_color", color, to=request.sid)
    emit("player_joined", rooms[room], room=room)

@socketio.on("make_move")
def handle_make_move(data):
    room = data["room"]
    current_color = data["color"]
    to_row = data["toRow"]
    to_col = data["toCol"]
    captured = data.get("capturedIndex")
    must_continue = data.get("mustContinue", False)

    # Vezir kontrolü (sunucu tarafında da yapılır)
    if (current_color == "red" and to_row == 0) or (current_color == "black" and to_row == 7):
        data["becameQueen"] = True
    else:
        data["becameQueen"] = False

    # Hamleyi yayınla (ilk olarak varsayılan)
    emit("move_made", data, room=room)

    # Zincirleme yeme devam etmiyorsa sıra değiştir
    if not must_continue:
        next_turn = "black" if current_color == "red" else "red"
        emit("turn_update", next_turn, room=room)

# Ana uygulama başlangıcı
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)

