import express, {Request, RequestHandler, Response} from "express";
import TicketDto from "./dto/laphil.response/TicketDto";
import SectionDto from "./dto/laphil.response/SectionDto";
import AvailableTicketDto from "./dto/response/AvailableTicketDto";

const app = express();
const port = 3000;

let sections = new Map<number, string>()
fetch("https://my.laphil.com/en/rest-proxy/ReferenceData/Sections")
    .then(res => res.json())
    .then((res: SectionDto[]) => sections = new Map(res.map(it => [it.Id, it.Description])))


const handleAvailableTicketsById: RequestHandler = (request: Request, response: Response) => {
    const id: string = "7288";
    // `modeOfSaleId=4` - why 4? with 0, 1, 2, 3 it is not work
    fetch(`https://my.laphil.com/en/rest-proxy/TXN/Performances/${id}/Seats?constituentId=0&modeOfSaleId=4&performanceId=${id}`)
        .then(res => res.json())
        .then((res: TicketDto[]) => res.filter(x => x.SeatStatusId === 0))
        .then(res => res.map(item => (
            {
                section: sections.get(item.SectionId) || "-",
                row: item.SeatRow,
                seatNumber: item.SeatNumber,
                price: 3.14 // todo
            } as AvailableTicketDto
        )))
        .then(res => response.status(200).json(res))
};

app.get("/laphil/available-tickets", handleAvailableTicketsById);

app.listen(port, () => {
    console.log(`Application is running on port ${port}.`);
});
