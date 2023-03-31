import express, {Request, RequestHandler, Response} from "express";
import Dependencies from "./Dependencies";
import TicketDto from "./dto/laphil.response/TicketDto";
import SectionDto from "./dto/laphil.response/SectionDto";
import AvailableTicketDto from "./dto/response/AvailableTicketDto";
import {Reader} from "fp-ts/Reader"

const app = express();
const port = 3000;


const sectionsPromise = fetch("https://my.laphil.com/en/rest-proxy/ReferenceData/Sections")
    .then(res => res.json())
    .then((res: SectionDto[]) => {
        return new Map(res.map(it => [it.Id, it.Description]));
    });

const handleAvailableTicketsById: Reader<Dependencies, RequestHandler> = (deps: Dependencies) =>
    (request: Request, response: Response) => {
        const id: string = request.params.performanceId;
        // todo: `modeOfSaleId=4` - why 4? with 0, 1, 2, 3 it is not work
        fetch(`https://my.laphil.com/en/rest-proxy/TXN/Performances/${id}/Seats?constituentId=0&modeOfSaleId=4&performanceId=${id}`)
            .then(res => res.json())
            .then((res: TicketDto[]) => res.filter(x => x.SeatStatusId === 0))
            .then(res => res.map(item => (
                {
                    section: deps.sections.get(item.SectionId) || "-",
                    row: item.SeatRow,
                    seatNumber: item.SeatNumber,
                    price: 3.14 // todo
                } as AvailableTicketDto
            )))
            .then(res => response.status(200).json(res))
    };

Promise.all([sectionsPromise]).then(([sections]) => {
    const deps: Dependencies = {sections}

    app.get("/laphil/available-tickets/:performanceId", handleAvailableTicketsById(deps));

    app.listen(port, () => {
        console.log(`Application is running on port ${port}.`);
    });
})

