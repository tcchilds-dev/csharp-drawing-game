using System.Text.Json.Serialization;

namespace DrawingGame.Api.Game.GameInternals;

public class Chat
{
    public List<Message> Messages { get; } = new();

    public void Clear()
    {
        Messages.Clear();
    }
}

public class Message
{
    public Guid? PlayerId { get; set; }
    public string? Username { get; set; }
    public string? Body { get; set; }
    public DateTimeOffset TimeStamp { get; set; }
    public MessageType MessageType { get; set; }

    public Message(Guid? playerId, string? username, string? body, MessageType messageType)
    {
        PlayerId = playerId;
        Username = username;
        Body = body;
        TimeStamp = DateTimeOffset.UtcNow;
        MessageType = messageType;
    }
}

[JsonConverter(typeof(JsonStringEnumConverter<MessageType>))]
public enum MessageType
{
    StandardMessage,
    CorrectGuessNotification,
    SystemMessage,
}
