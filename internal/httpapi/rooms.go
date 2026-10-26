package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/kratzbaum/kratzbaum/internal/storage"
)

// Explicit optional fields distinguish omitted values in older clients from clears.
type plantInput struct {
	storage.Plant
	CareStart *string         `json:"care_start_date"`
	Room      json.RawMessage `json:"room_id"`
}

func decodePlant(w http.ResponseWriter, r *http.Request, previous *storage.Plant) (storage.Plant, bool) {
	var input plantInput
	if !decode(w, r, &input) {
		return storage.Plant{}, false
	}
	p := input.Plant
	if input.CareStart != nil {
		p.CareStartDate = *input.CareStart
	} else if previous != nil {
		p.CareStartDate = previous.CareStartDate
	}
	if input.Room != nil {
		if err := json.Unmarshal(input.Room, &p.RoomID); err != nil {
			fail(w, 400, "Invalid room ID")
			return p, false
		}
	} else if previous != nil {
		p.RoomID = previous.RoomID
	}
	if message := validPlant(p); message != "" {
		fail(w, 400, message)
		return p, false
	}
	return p, true
}

func plantSaveError(w http.ResponseWriter, err error) {
	if errors.Is(err, storage.ErrRoomReference) {
		fail(w, 400, err.Error())
		return
	}
	fail(w, 500, "Could not save plant")
}

func (s *Server) rooms(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		rooms, err := s.Store.ListRooms(r.Context())
		if err != nil {
			fail(w, 500, "Could not load rooms")
			return
		}
		jsonOut(w, 200, map[string]any{"rooms": rooms})
		return
	}
	s.saveRoom(w, r, "")
}

func (s *Server) room(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		fail(w, 400, "Invalid room ID")
		return
	}
	if r.Method == http.MethodDelete {
		err := s.Store.DeleteRoom(r.Context(), id)
		if err != nil {
			roomError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	s.saveRoom(w, r, id)
}

func (s *Server) saveRoom(w http.ResponseWriter, r *http.Request, id string) {
	var input struct {
		Name string `json:"name"`
	}
	if !decode(w, r, &input) {
		return
	}
	room, err := s.Store.SaveRoom(r.Context(), id, input.Name)
	if err != nil {
		roomError(w, err)
		return
	}
	status := http.StatusOK
	if id == "" {
		status = http.StatusCreated
	}
	jsonOut(w, status, room)
}

func roomError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sql.ErrNoRows):
		fail(w, 404, "Room not found")
	case errors.Is(err, storage.ErrRoomName), errors.Is(err, storage.ErrRoomDuplicate):
		fail(w, 400, err.Error())
	default:
		fail(w, 500, "Could not save room changes")
	}
}
