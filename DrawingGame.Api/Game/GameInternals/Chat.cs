using System.Text.Json.Serialization;

namespace DrawingGame.Api.Game.GameInternals;

public class Chat
{
    public List<Message> Messages { get; } = new();
}

public class Message
{
    public Guid? PlayerId;
    public string? Username;
    public string? Body;
    public required DateTimeOffset TimeStamp;
    public required MessageType MessageType;
}

[JsonConverter(typeof(JsonStringEnumConverter<MessageType>))]
public enum MessageType
{
    StandardMessage,
    CorrectGuessNotification,
    SystemMessage,
}
